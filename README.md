# Consolite.js

This is a port of the [Consolite Assembler](https://github.com/rfotino/consolite-assembler)
and the [Consolite Emulator](https://github.com/rfotino/consolite-emulator) in JavaScript,
using the HTML5 canvas as a display.

## Usage

You can find a more complete example in `demo.html`.

```html
<!-- We need a canvas for the emulator to draw to -->
<canvas id='display' width='256' height='192'></canvas>

<!-- Load the assembler and emulator JavaScript files -->
<script type="text/javascript" src="assembler.js"></script>
<script type="text/javascript" src="emulator.js"></script>

<script type="text/javascript">
  // Give the assembler some code to turn into binary instructions
  var assemblyCode = 'MOVI SP 0xff00';
  var asm = new Consolite.Assembler(assemblyCode);
  try {
    // bin is a Uint8Array
    var bin = asm.getBinary();
    // keymap is a mapping of human readable key constants to
    // the input ids referenced in the binary code
    var keymap = [
      { keyCode: Consolite.Emulator.Keys.SPACE, inputId: 0 },
      { keyCode: Consolite.Emulator.Keys.LEFT, inputId: 1 },
      { keyCode: Consolite.Emulator.Keys.RIGHT, inputId: 2 }
    ];
    // Initialize the emulator with the binary, the keymap, and
    // the id of the canvas we're using as a display
    var emu = new Consolite.Emulator(bin, keymap, 'display');
    // Start the emulation
    emu.run();
    // Call emu.halt() to stop the emulation
  } catch (errors) {
    // errors is an array of error strings
    console.log(errors);
  }
</script>
```
