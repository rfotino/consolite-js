/**
 * Port of the Consolite Assembler in JavaScript
 * Copyright (c) 2015 Robert Fotino, All Rights Reserved
 */

if (typeof Consolite === 'undefined') {
    Consolite = {};
}

Consolite.Assembler = function(assemblyCode) {
    this._input = assemblyCode;
    this._output = null;
    this._tokenLines = [];
    this._labels = {};
    this._labelRefs = [];
    this._byteLength = 0;
    this._bytesOutputTotal = 0;
    this._opcodes = {
        'NOP':   0x00,
        'INPUT': 0x01,
        'CALL':  0x02,
        'RET':   0x03,
        'LOAD':  0x04,
        'LOADI': 0x05,
        'MOV':   0x06,
        'MOVI':  0x07,
        'PUSH':  0x08,
        'POP':   0x09,
        'ADD':   0x0a,
        'SUB':   0x0b,
        'MUL':   0x0c,
        'DIV':   0x0d,
        'AND':   0x0e,
        'OR':    0x0f,
        'XOR':   0x10,
        'SHL':   0x11,
        'SHRA':  0x12,
        'SHRL':  0x13,
        'CMP':   0x14,
        'TST':   0x15,
        'COLOR': 0x16,
        'PIXEL': 0x17,
        'STOR':  0x18,
        'STORI': 0x19,
        'TIME':  0x1a,
        'TIMERST': 0x1b,
        'RND':   0x1c,
        'JMP':   0x30,
        'JMPI':  0x31,
        'JEQ':   0x32,
        'JNE':   0x33,
        'JG':    0x34,
        'JGE':   0x35,
        'JA':    0x36,
        'JAE':   0x37,
        'JL':    0x38,
        'JLE':   0x39,
        'JB':    0x3a,
        'JBE':   0x3b,
        'JO':    0x3c,
        'JNO':   0x3d,
        'JS':    0x3e,
        'JNS':   0x3f
    };
    this._registers = {
        'SP': 0x0, 'R0':  0x0,
        'FP': 0x1, 'R1':  0x1,
        'A':  0x2, 'R2':  0x2,
        'B':  0x3, 'R3':  0x3,
        'C':  0x4, 'R4':  0x4,
        'D':  0x5, 'R5':  0x5,
        'E':  0x6, 'R6':  0x6,
        'F':  0x7, 'R7':  0x7,
        'G':  0x8, 'R8':  0x8,
        'H':  0x9, 'R9':  0x9,
        'I':  0xa, 'R10': 0xa,
        'J':  0xb, 'R11': 0xb,
        'K':  0xc, 'R12': 0xc,
        'L':  0xd, 'R13': 0xd,
        'M':  0xe, 'R14': 0xe,
        'N':  0xf, 'R15': 0xf
    };
};

Consolite.Assembler.prototype = {
    _getData: function(str) {
        // Remove the leading '0x'
        str = str.slice(2);
        // Pad with leading zero if odd number of digits
        if (1 == str.length % 2) {
            str = '0' + str;
        }
        // Read the bytes and pack them into a string
        var output = '';
        for (var i = 0; i < str.length; i += 2) {
            var byte = parseInt(str.slice(i, i + 2), 16);
            output += String.fromCharCode(byte);
        }
        return output;
    },
    _isValidData: function(str) {
        return null !== str.match(/^0x[0-9a-fA-F]+$/);
    },
    _isValidLabel: function(str) {
        return null !== str.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    },
    _getToken: function(str) {
        if (str in this._opcodes) {
            return { type: 'opcode', data: str };
        } else if (str in this._registers) {
            return { type: 'register', data: str };
        } else if (this._isValidData(str)) {
            return { type: 'data', data: this._getData(str) };
        } else if (':' === str.slice(-1) &&
                   this._isValidLabel(str.slice(0, -1))) {
            return { type: 'labeldecl', data: str.slice(0, -1) };
        } else if (this._isValidLabel(str)) {
            return { type: 'labelref', data: str };
        } else {
            return { type: 'unknown', data: str };
        }
    },
    _validateInstruction: function(tokens, lineNum) {
        var opcode = tokens[0].data;
        if (-1 !== ['NOP', 'TIMERST'].indexOf(opcode)) {
            if (1 < tokens.length) {
                throw 'Error: Invalid syntax for ' + opcode +
                    ', must be by itself on line ' + lineNum + '.';
            }
        } else if (-1 !== ['INPUT', 'LOAD', 'MOV', 'ADD', 'SUB', 'MUL', 'DIV',
                           'AND', 'OR', 'XOR', 'SHL', 'SHRA', 'SHRL', 'CMP',
                           'TST', 'PIXEL', 'STOR'].indexOf(opcode)) {
            if (3 !== tokens.length ||
                'register' !== tokens[1].type ||
                'register' !== tokens[2].type) {
                throw 'Error: Invalid syntax for ' + opcode + ', expected ' +
                    opcode + ' REG1 REG2 on line ' + lineNum + '.';
            }
        } else if (-1 !== ['PUSH', 'POP', 'COLOR',
                           'JMP', 'TIME', 'RND'].indexOf(opcode)) {
            if (2 !== tokens.length ||
                'register' !== tokens[1].type) {
                throw 'Error: Invalid syntax for ' + opcode + ', expected ' +
                    opcode + ' REG on line ' + lineNum + '.';
            }
        } else if (-1 !== ['CALL', 'JMPI', 'JEQ', 'JNE', 'JG', 'JGE', 'JA',
                           'JAE', 'JL', 'JLE', 'JB', 'JBE', 'JO', 'JNO',
                           'JS', 'JNS'].indexOf(opcode)) {
            if (2 !== tokens.length ||
                -1 === ['data', 'labelref'].indexOf(tokens[1].type)) {
                throw 'Error: Invalid syntax for ' + opcode + ', expected ' +
                    opcode + ' REG on line ' + lineNum + '.';
            } else if ('data' === tokens[1].type && 2 < tokens[1].data.length) {
                throw 'Error: Data too large, max of 16 bits on line ' +
                    lineNum + '.';
            } else if ('labelref' === tokens[1].type) {
                // Save the label reference for later validation
                // against the full list of label declarations.
                this._labelRefs.push({
                    label: tokens[1].data,
                    lineNum: lineNum
                });
            }
        } else if ('RET' === opcode) {
            if (2 < tokens.length ||
                (2 === tokens.length && 'data' !== tokens[1].type)) {
                throw 'Error: Invalid syntax for ' + opcode + ', expected ' +
                    opcode + ' [DATA] on line ' + lineNum + '.';
            } else if (2 === tokens.length && 1 < tokens[1].data.length) {
                throw 'Error: Data too large, max of 8 bits on line ' +
                    lineNum + '.';
            }
        } else if (-1 !== ['LOADI', 'STORI', 'MOVI'].indexOf(opcode)) {
            if (3 !== tokens.length ||
                'register' !== tokens[1].type ||
                -1 === ['data', 'labelref'].indexOf(tokens[2].type)) {
                throw 'Error: Invalid syntax for ' + opcode + ', expected ' +
                    opcode + ' REG LABEL|DATA on line ' + lineNum + '.';
            } else if ('data' === tokens[2].type && 2 < tokens[2].data.length) {
                throw 'Error: Data too large, max of 16 bits on line' +
                    lineNum + '.';
            } else if ('labelref' === tokens[2].type) {
                // Save the label reference for later validation
                // against the full list of label declarations.
                this._labelRefs.push({
                    label: tokens[2].data,
                    lineNum: lineNum
                });
            }
        }
    },
    _firstPass: function() {
        var errors = [];
        var lineNum = 0;
        
        var lines = this._input.split('\n');
        for (var i = 0; i < lines.length; i++) {
            lineNum++;
            var line = lines[i].split(';')[0]; // Strip out comments
            var words = line.split(/\s+/);
            var tokens = [];
            for (var j = 0; j < words.length; j++) {
                if ('' === words[j]) {
                    continue;
                }
                tokens.push(this._getToken(words[j]));
            }
            // Do nothing if this is an empty line
            if (0 === tokens.length) {
                continue;
            }
            // Validate based on lead token
            switch (tokens[0].type) {
            case 'opcode':
                // Do further validation based on the specific opcode
                try {
                    this._validateInstruction(tokens, lineNum);
                    this._byteLength += 4;
                } catch (error) {
                    errors.push(error);
                }
                break;
            case 'register':
                // Line can't start with a register
                errors.push('Error: REG "' + tokens[0].data + '"' +
                            ' not allowed at start of instruction on line ' +
                            lineNum + '.');
                break;
            case 'data':
                // Make sure all tokens on this line are data, and add
                // their sizes to the byte offset at this point.
                for (var j = 0; j < tokens.length; j++) {
                    if ('data' === tokens[j].type) {
                        this._byteLength += tokens[j].data.length;
                    } else {
                        errors.push('Error: Unknown token "' + tokens[j].data +
                                    '", expected DATA on line ' + lineNum +
                                    '.');
                        break;
                    }
                }
                // Pad data to 4 bytes so that instructions that follow
                // are aligned correctly
                while (0 !== this._byteLength % 4) {
                    this._byteLength++;
                }
                break;
            case 'labeldecl':
                var label = tokens[0].data;
                if (1 === tokens.length) {
                    if (!(label in this._labels)) {
                        // Save the byte position for substituting in for
                        // references to the label
                        this._labels[label] = this._byteLength;
                    } else {
                        // Duplicate labels are ambiguous
                        errors.push('Error: Duplicate LABEL "' + label +
                                    '" on line ' + lineNum + '.');
                    }
                } else {
                    // Label declaration must be on a line by itself
                    errors.push('Error: Invalid syntax, LABEL "' + label +
                                '" must be by itself on line ' + lineNum + '.');
                }
                break;
            case 'labelref':
            case 'unknown':
            default:
                errors.push('Error: Unknown token "' + tokens[0].data +
                            '" on line ' + lineNum + '.');
                break;
            }
            // Add these tokens to tokenLines for use in second pass
            if (0 === errors.length) {
                this._tokenLines.push(tokens);
            }
        }

        if (0 === errors.length) {
            // Check that all of the label references have a corresponding
            // label. If not, that is another error
            for (var i = 0; i < this._labelRefs.length; i++) {
                var labelRef = this._labelRefs[i].label;
                var lineRef = this._labelRefs[i].lineNum;
                if (!(labelRef in this._labels)) {
                    errors.push('Error: Could not find LABEL for reference "' +
                                labelRef + '" on line ' + lineRef + '.');
                }
            }
            // Check if the total size of the output will be too large,
            // which would be another error
            if ((1 << 16) < this._byteLength) {
                errors.push('Error: Output would be ' + this._byteLength +
                            ' bytes, which is larger than the maximum output ' +
                            'size of ' + (1 << 16) + ' bytes.');
            }
        }

        if (0 < errors.length) {
            throw errors;
        }
    },
    _writeOutput: function(str) {
        for (var i = 0; i < str.length; i++) {
            this._output[this._bytesOutputTotal] = str.charCodeAt(i);
            this._bytesOutputTotal++;
        }
    },
    _secondPass: function() {
        this._output = new Uint8Array(this._byteLength);
        for (var i = 0; i < this._tokenLines.length; i++) {
            var tokens = this._tokenLines[i];
            // For the second pass we only care about lines starting
            // with an opcode or data
            switch (tokens[0].type) {
            case 'opcode':
                var opcode = tokens[0].data;
                var bytesOutput = 0;
                for (var j = 0; j < tokens.length; j++) {
                    switch (tokens[j].type) {
                    case 'opcode':
                        var opcodeValue = this._opcodes[tokens[j].data];
                        this._writeOutput(String.fromCharCode(opcodeValue));
                        bytesOutput++;
                        break;
                    case 'register':
                        var registerValue = this._registers[tokens[j].data];
                        this._writeOutput(String.fromCharCode(registerValue));
                        bytesOutput++;
                        break;
                    case 'data':
                        // The RET instruction has only 1 byte of data following
                        // it. All other instructions with data have 2 bytes,
                        // and must be padded if they are using only one.
                        if ('RET' === opcode) {
                            bytesOutput++;
                        } else {
                            bytesOutput += 2;
                            if (1 === tokens[j].data.length) {
                                this._writeOutput(String.fromCharCode(0));
                            }
                        }
                        this._writeOutput(tokens[j].data);
                        break;
                    case 'labelref':
                        bytesOutput += 2;
                        var address = this._labels[tokens[j].data];
                        var addressStr = '';
                        addressStr += String.fromCharCode((address >> 8) & 0xff);
                        addressStr += String.fromCharCode(address & 0xff);
                        this._writeOutput(addressStr);
                        break;
                    case 'labeldecl':
                    case 'unknown':
                    default:
                        break;
                    }
                }
                // Output any padding bytes necessary
                while (bytesOutput < 4) {
                    this._writeOutput(String.fromCharCode(0));
                    bytesOutput++;
                }
                break;
            case 'data':
                // Directly output all data, in big endian order
                var dataSize = 0;
                for (var j = 0; j < tokens.length; j++) {
                    this._writeOutput(tokens[j].data);
                    dataSize += tokens[j].data.length;
                }
                // Make sure to pad the data to a multiple of 4 bytes,
                // so that any instructions that follow are aligned properly.
                while (0 !== dataSize % 4) {
                    this._writeOutput(String.fromCharCode(0));
                    dataSize++;
                }
                break;
            }
        }
    },
    getBinary: function() {
        try {
            this._firstPass();
            this._secondPass();
        } catch (errors) {
            throw errors;
        }
        return this._output;
    }
};
