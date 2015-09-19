/**
 * Port of the Consolite Emulator in JavaScript
 * Copyright (c) 2015 Robert Fotino, All Rights Reserved
 */

if (typeof Consolite === 'undefined') {
    Consolite = {};
}

Consolite.Emulator = function(binary, keymap, canvasId) {
    // Get the graphics context from the canvasId
    this._canvas = document.getElementById(canvasId);
    this._ctx = this._canvas.getContext('2d');
    
    // Paint it black to start
    this._ctx.fillStyle = 'rgb(0,0,0)';
    this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // Add an event listener to the canvas for input
    var that = this;
    this._canvas.addEventListener('keydown', function(e) {
        that.sendKeyEvent(e.keyCode, true);
        e.preventDefault();
    });
    this._canvas.addEventListener('keyup', function(e) {
        that.sendKeyEvent(e.keyCode, false);
        e.preventDefault();
    });
    this._keymap = keymap;
    this._keyState = [];

    // Copy the binary into main memory
    this._mainMem = new Uint8Array(1 << 16);
    for (var i = 0; i < binary.length && i < this._mainMem.length; i++) {
        this._mainMem[i] = binary[i];
    }

    // Initialize registers and flags
    this._registers = new Uint16Array(16);
    this._instructionPointer = 0;
    this._colorRegister = 0;
    this._overflowFlag = false;
    this._carryFlag = false;
    this._zeroFlag = false;
    this._signFlag = false;
    this._running = false;

    // Initialize time since last call to TIMERST
    this._timeSinceRst = Date.now();

    // Set up map of human readable identifier to opcode
    this._opcodes = {
        NOP:   0x00,
        INPUT: 0x01,
        CALL:  0x02,
        RET:   0x03,
        LOAD:  0x04,
        LOADI: 0x05,
        MOV:   0x06,
        MOVI:  0x07,
        PUSH:  0x08,
        POP:   0x09,
        ADD:   0x0a,
        SUB:   0x0b,
        MUL:   0x0c,
        DIV:   0x0d,
        AND:   0x0e,
        OR:    0x0f,
        XOR:   0x10,
        SHL:   0x11,
        SHRA:  0x12,
        SHRL:  0x13,
        CMP:   0x14,
        TST:   0x15,
        COLOR: 0x16,
        PIXEL: 0x17,
        STOR:  0x18,
        STORI: 0x19,
        TIME:  0x1a,
        TIMERST: 0x1b,
        RND:   0x1c,
        JMP:   0x30,
        JMPI:  0x31,
        JEQ:   0x32,
        JNE:   0x33,
        JG:    0x34,
        JGE:   0x35,
        JA:    0x36,
        JAE:   0x37,
        JL:    0x38,
        JLE:   0x39,
        JB:    0x3a,
        JBE:   0x3b,
        JO:    0x3c,
        JNO:   0x3d,
        JS:    0x3e,
        JNS:   0x3f
    };
};

// Mapping of human readable constant names
// to keycodes, for use in creating key maps.
Consolite.Emulator.Keys = {
    CANCEL: 3,
    HELP: 6,
    BACK_SPACE: 8,
    TAB: 9,
    CLEAR: 12,
    RETURN: 13,
    ENTER: 14,
    SHIFT: 16,
    CONTROL: 17,
    ALT: 18,
    PAUSE: 19,
    CAPS_LOCK: 20,
    ESCAPE: 27,
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    PRINTSCREEN: 44,
    INSERT: 45,
    DELETE: 46,
    _0: 48,
    _1: 49,
    _2: 50,
    _3: 51,
    _4: 52,
    _5: 53,
    _6: 54,
    _7: 55,
    _8: 56,
    _9: 57,
    SEMICOLON: 59,
    EQUALS: 61,
    A: 65,
    B: 66,
    C: 67,
    D: 68,
    E: 69,
    F: 70,
    G: 71,
    H: 72,
    I: 73,
    J: 74,
    K: 75,
    L: 76,
    M: 77,
    N: 78,
    O: 79,
    P: 80,
    Q: 81,
    R: 82,
    S: 83,
    T: 84,
    U: 85,
    V: 86,
    W: 87,
    X: 88,
    Y: 89,
    Z: 90,
    CONTEXT_MENU: 93,
    NUMPAD0: 96,
    NUMPAD1: 97,
    NUMPAD2: 98,
    NUMPAD3: 99,
    NUMPAD4: 100,
    NUMPAD5: 101,
    NUMPAD6: 102,
    NUMPAD7: 103,
    NUMPAD8: 104,
    NUMPAD9: 105,
    MULTIPLY: 106,
    ADD: 107,
    SEPARATOR: 108,
    SUBTRACT: 109,
    DECIMAL: 110,
    DIVIDE: 111,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    F13: 124,
    F14: 125,
    F15: 126,
    F16: 127,
    F17: 128,
    F18: 129,
    F19: 130,
    F20: 131,
    F21: 132,
    F22: 133,
    F23: 134,
    F24: 135,
    NUM_LOCK: 144,
    SCROLL_LOCK: 145,
    COMMA: 188,
    PERIOD: 190,
    SLASH: 191,
    BACK_QUOTE: 192,
    OPEN_BRACKET: 219,
    BACK_SLASH: 220,
    CLOSE_BRACKET: 221,
    QUOTE: 222,
    META: 224
};

Consolite.Emulator.prototype = {
    sendKeyEvent: function(keyCode, status) {
        // Search the keymap for the given keyCode, if we find
        // it then set the corresponding inputId to the given
        // status.
        status = status ? true : false;
        for (var i = 0; i < this._keymap.length; i++) {
            if (keyCode === this._keymap[i].keyCode) {
                this._keyState[this._keymap[i].inputId] = status;
                break;
            }
        }
    },
    _getInput: function(inputId) {
        if (inputId in this._keyState) {
            return this._keyState[inputId];
        } else {
            return 0;
        }
    },
    _push: function(val) {
        // Increment the stack pointer and push the value
        // onto the stack.
        this._registers[0] += 2;
        var sp = this._registers[0];
        this._mainMem[sp] = val >> 8;
        this._mainMem[sp+1] = val & 0xff;
    },
    _pop: function() {
        // Pop a value off of the stack and decrement the stack
        // pointer.
        var sp = this._registers[0];
        var val = (this._mainMem[sp] << 8) | this._mainMem[sp+1];
        this._registers[0] -= 2;
        return val;
    },
    _setInstructionPointer: function(ip) {
        // Clear out the bottom two bits to align the instruction
        // pointer to four bytes.
        this._instructionPointer = ip & 0xfffc;
    },
    _setFlags: function(dest, src, result, opcode) {
        // Overflow set if we added two positives and got a negative,
        // added two negatives and got a positive, subtracted a
        // positive from a negative and got a positive, or subtracted
        // a negative from a positive and got a negative.
        if (this._opcodes.ADD === opcode) {
            this._overflowFlag =
                ((0x8000 & dest) && (0x8000 & src) && !(0x8000 & result)) ||
                (!(0x8000 & dest) && !(0x8000 & src) && (0x8000 & result));
        } else if (this._opcodes.SUB === opcode ||
                   this._opcodes.CMP === opcode) {
            this._overflowFlag =
                ((0x8000 & dest) && !(0x8000 & src) && !(0x8000 & result)) ||
                (!(0x8000 & dest) && (0x8000 & src) && (0x8000 & result));
        } else {
            this._overflowFlag = false;
        }
        // Carry set if c is too large to fit into 16 bits
        this._carryFlag = 0xffff < result || result < 0;
        // Zero set if the result was zero
        this._zeroFlag = !(0xffff & result);
        // Sign flag set if the sign bit of the result is set
        this._signFlag = !!(0x8000 & result);
    },
    _setPixel: function(x, y) {
        // Unpack the RGB value from the color register
        var red = this._colorRegister & 0xe0;
        var green = (this._colorRegister & 0x1c) << 3;
        var blue = (this._colorRegister & 0x03) << 6;
        this._ctx.fillStyle = 'rgb('+red+','+green+','+blue+')';
        // Calculate the integer coordinates of this pixel and draw
        // to the screen.
        var scaleX = this._canvas.width / 256;
        var scaleY = this._canvas.height / 192;
        var rectX = Math.floor(x * scaleX);
        var rectY = Math.floor(y * scaleY);
        var rectW = Math.floor((x+1) * scaleX) - rectX;
        var rectH = Math.floor((y+1) * scaleY) - rectY;
        this._ctx.fillRect(rectX, rectY, rectW, rectH);
    },
    _executeNext: function() {
        var opcode = this._mainMem[this._instructionPointer];
        var arg1 = this._mainMem[this._instructionPointer + 1];
        var arg2 = this._mainMem[this._instructionPointer + 2];
        var reg1 = arg1 & 0xf;
        var reg2 = arg2 & 0xf;
        var argA = (this._mainMem[this._instructionPointer + 1] << 8) |
                   this._mainMem[this._instructionPointer + 2];
        var argB = (this._mainMem[this._instructionPointer + 2] << 8) |
                   this._mainMem[this._instructionPointer + 3];

        var dest = this._registers[reg1];
        var src = this._registers[reg2];
        var result;

        var nextInstPtr = this._instructionPointer + 4;
        var clearFlags = true;

        switch (opcode) {
        case this._opcodes.NOP:
        default:
            break;
        case this._opcodes.INPUT:
            this._registers[reg1] = this._getInput(src);
            break;
        case this._opcodes.CALL:
            this._push(this._instructionPointer);
            nextInstPtr = argA;
            break;
        case this._opcodes.RET:
            nextInstPtr = this._pop() + arg1 + 4;
            break;
        case this._opcodes.LOAD:
            this._registers[reg1] =
                (this._mainMem[src] << 8) | this._mainMem[src+1];
            break;
        case this._opcodes.LOADI:
            this._registers[reg1] =
                (this._mainMem[argB] << 8) | this._mainMem[argB+1];
            break;
        case this._opcodes.MOV:
            this._registers[reg1] = src;
            break;
        case this._opcodes.MOVI:
            this._registers[reg1] = argB;
            break;
        case this._opcodes.PUSH:
            this._push(dest);
            break;
        case this._opcodes.POP:
            this._registers[reg1] = this._pop();
            break;
        case this._opcodes.ADD:
            this._registers[reg1] += src;
            result = dest + src;
            clearFlags = false;
            break;
        case this._opcodes.SUB:
            this._registers[reg1] -= src;
            result = dest - src;
            clearFlags = false;
            break;
        case this._opcodes.MUL:
            this._registers[reg1] *= src;
            result = dest * src;
            clearFlags = false;
            break;
        case this._opcodes.DIV:
            this._registers[reg1] /= src;
            // Check for divide by zero, in that case set to all ones.
            if (0 === src) {
                result = 0xffff;
            } else {
                result = Math.floor(dest / src);
            }
            clearFlags = false;
            break;
        case this._opcodes.AND:
            this._registers[reg1] &= src;
            result = dest & src;
            clearFlags = false;
            break;
        case this._opcodes.OR:
            this._registers[reg1] |= src;
            result = dest | src;
            clearFlags = false;
            break;
        case this._opcodes.XOR:
            this._registers[reg1] ^= src;
            result = dest ^ src;
            clearFlags = false;
            break;
        case this._opcodes.SHL:
            this._registers[reg1] <<= src;
            result = dest << src;
            clearFlags = false;
            break;
        case this._opcodes.SHRA:
            this._registers[reg1] >>= src;
            result = dest >> src;
            clearFlags = false;
            break;
        case this._opcodes.SHRL:
            this._registers[reg1] >>>= src;
            result = dest >>> src;
            clearFlags = false;
            break;
        case this._opcodes.CMP:
            result = dest - src;
            clearFlags = false;
            break;
        case this._opcodes.TST:
            result = dest & src;
            clearFlags = false;
            break;
        case this._opcodes.COLOR:
            this._colorRegister = dest & 0xff;
            break;
        case this._opcodes.PIXEL:
            this._setPixel(dest, src);
            break;
        case this._opcodes.STOR:
            this._mainMem[src] = dest >> 8;
            this._mainMem[src+1] = dest & 0xff;
            break;
        case this._opcodes.STORI:
            this._mainMem[argB] = dest >> 8;
            this._mainMem[argB+1] = dest & 0xff;
            break;
        case this._opcodes.TIME:
            this._registers[reg1] = Date.now() - this._timeSinceRst;
            break;
        case this._opcodes.TIMERST:
            this._timeSinceRst = Date.now();
            break;
        case this._opcodes.RND:
            this._registers[reg1] = Math.floor(Math.random() * (1 << 16));
            break;
        case this._opcodes.JMP:
            nextInstPtr = dest;
            break;
        case this._opcodes.JMPI:
            nextInstPtr = argA;
            break;
        case this._opcodes.JEQ:
            if (this._zeroFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JNE:
            if (!this._zeroFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JG:
            if (!this._zeroFlag && this._signFlag === this._overflowFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JGE:
            if (this._signFlag === this._overflowFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JA:
            if (!this._carryFlag && !this._zeroFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JAE:
            if (!this._carryFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JL:
            if (this._signFlag !== this._overflowFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JLE:
            if (this._signFlag !== this._overflowFlag || this._zeroFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JB:
            if (this._carryFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JBE:
            if (this._carryFlag || this._zeroFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JO:
            if (this._overflowFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JNO:
            if (!this._overflowFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JS:
            if (this._signFlag) {
                nextInstPtr = argA;
            }
            break;
        case this._opcodes.JNS:
            if (!this._signFlag) {
                nextInstPtr = argA;
            }
            break;
        }

        // Set the instruction pointer to its new position
        this._setInstructionPointer(nextInstPtr);
        // Clear the flags if they were not set somewhere else
        if (clearFlags) {
            this._overflowFlag = false;
            this._carryFlag = false;
            this._zeroFlag = false;
            this._signFlag = false;
        } else {
            this._setFlags(dest, src, result, opcode);
        }
    },
    _runAtIntervals: function() {
        if (!this._running) {
            return;
        }

        // Use intervals of 10 milliseconds between calls to this
        // function (usually the browser minimum, and we don't need
        // more granularity than that).
        var interval = 10;
        var timeLimit = Date.now() + interval;

        // The setTimeout function uses the global context so
        // we won't be able to access 'this' next time we go through
        // this function unless we make a closure. We call setTimeout
        // at the start of the function so that this function can
        // be scheduled to run  again almost immediately after this
        // instance exits.
        var that = this;
        setTimeout(function() { that._runAtIntervals() }, interval);

        // Keep executing until the allotted time is up. Check
        // every 100 instructions to see if we are at or past
        // the time limit.
        var instCounter = 0;
        while (true) {
            this._executeNext();
            instCounter++;
            if (100 === instCounter) {
                instCounter = 0;
                if (timeLimit <= Date.now()) {
                    break;
                }
            }
        }
    },
    run: function() {
        this._canvas.focus();
        this._running = true;
        this._runAtIntervals();
    },
    halt: function() {
        this._running = false;
    }
};
