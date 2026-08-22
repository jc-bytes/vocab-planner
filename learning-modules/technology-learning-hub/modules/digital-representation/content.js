import { history, item, practice } from "../../shared/content-helpers.js";

const pixels = `<div class="fm-pixel-grid" role="img" aria-label="A four by four pixel mosaic. Five pixels are filled and eleven are empty."><i></i><i></i><i class="on"></i><i></i><i></i><i class="on"></i><i class="on"></i><i></i><i></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i><i></i><i></i></div>`;

const representationBrief = `<section class="fm-block"><p class="fm-label">Fixed brief</p><h2>Use these four cases in your record</h2><div class="fm-table-wrap"><table><thead><tr><th>Case</th><th>Given information</th><th>What to record</th></tr></thead><tbody><tr><td>B1</td><td>Decimal 13 and binary 0110</td><td>Convert both values and show the place values used.</td></tr><tr><td>I1</td><td>32 × 20 pixels, 8 bits per pixel</td><td>Find the pixel count and uncompressed size in bits.</td></tr><tr><td>S1</td><td>Mono audio, 12 samples per second, 8 bits per sample, 3 seconds</td><td>Find the uncompressed size in bits.</td></tr><tr><td>D1</td><td>A school icon must stay clear but download quickly.</td><td>Choose one image setting to test and explain the quality-size trade-off.</td></tr></tbody></table></div><p class="fm-note">Keep the case codes in your answers. They make the exported report reconstructable.</p></section>`;

export const MODULE = {
  id: "MOD-DIGITAL-REPRESENTATION-01",
  slug: "digital-representation",
  version: "0.1.0",
  storageKey: "mod-digital-representation-01-v0.1.0",
  mark: "BIT",
  shortTitle: "Digital representation",
  title: "Binary, Images, and Sound",
  gradeLabel: "Grades 8-9 Technology",
  classes: ["8A", "8B", "9A", "9B"],
  sections: [
    {
      id: "start",
      short: "Start",
      title: "Represent information with numbers",
      summary: "Learn how bits can represent numbers, image pixels, and sound samples before you begin the practice sets.",
      minutes: 5,
      html: `<section class="fm-opening"><div><p class="fm-label">Goal</p><h2>The same bits can mean different things</h2><p>A <strong>representation</strong> is an agreed way to store or show information. Software follows rules that interpret a bit pattern as a number, color, sound sample, symbol, or instruction.</p><p>Work in this order: learn binary, practice binary, learn images, practice images, learn sound, then practice sound.</p></div>${pixels}</section>`,
    },
    {
      id: "binary-learn",
      short: "Learn binary",
      title: "Read place values in binary",
      summary: "Learn the vocabulary and method needed to convert small unsigned values.",
      minutes: 15,
      html: `<section class="fm-block"><p class="fm-label">Learn</p><h2>Binary uses two symbols</h2><div class="fm-concept-grid"><div><h3>Bit</h3><p>One binary digit. Its value is 0 or 1.</p></div><div><h3>Binary</h3><p>A base-two number system.</p></div><div><h3>Decimal</h3><p>The base-ten system used for everyday counting.</p></div><div><h3>Place value</h3><p>The amount a position contributes when its bit is 1.</p></div></div><div class="fm-table-wrap"><table><thead><tr><th>8</th><th>4</th><th>2</th><th>1</th><th>Decimal result</th></tr></thead><tbody><tr><td>1</td><td>0</td><td>1</td><td>1</td><td>8 + 2 + 1 = 11</td></tr><tr><td>0</td><td>0</td><td>1</td><td>1</td><td>2 + 1 = 3</td></tr></tbody></table></div><p>To read binary, add the place values whose bit is 1. To write binary, choose place values that add to the decimal value.</p><p class="fm-note">Leading zeros do not change the value. 0011 and 11 both represent decimal 3. Four bits represent 16 patterns, numbered 0 through 15.</p></section>`,
    },
    practice("binary-practice", "Binary practice", "Practice binary conversion", "Complete five activities using the 8, 4, 2, 1 place values.", [
      item("Read 0101", "What is binary 0101 in decimal?", ["5", "6", "9"], 0, "Convert binary to decimal", "The active positions are 4 and 1, so the value is 5.", "Write 8, 4, 2, 1 above the bits. Add only the positions marked 1."),
      item("Read 1010", "What is binary 1010 in decimal?", ["10", "12", "8"], 0, "Convert binary to decimal", "The active positions are 8 and 2, so the value is 10.", "Use the 8, 4, 2, 1 place-value row."),
      item("Write decimal 7", "Which four-bit value represents decimal 7?", ["0111", "1001", "0101"], 0, "Convert decimal to binary", "4 + 2 + 1 = 7, so those three positions contain 1.", "Choose place values that add to 7."),
      item("Write decimal 12", "Which four-bit value represents decimal 12?", ["1100", "1010", "1111"], 0, "Convert decimal to binary", "8 + 4 = 12, so the first two positions contain 1.", "Start with the largest place value that fits."),
      item("Count patterns", "How many values can four bits represent, including zero?", ["16", "4", "8"], 0, "Relate bits to combinations", "Each of four bits has two states, so 2 × 2 × 2 × 2 = 16 patterns.", "Multiply two choices once for each bit."),
    ]),
    {
      id: "image-learn",
      short: "Learn images",
      title: "Build an image from pixels and RGB values",
      summary: "Learn how resolution and color depth affect image detail and uncompressed size.",
      minutes: 15,
      html: `<section class="fm-block"><p class="fm-label">Learn</p><h2>A digital image is a grid of pixels</h2>${pixels}<div class="fm-concept-grid"><div><h3>Pixel</h3><p>One picture element in the grid.</p></div><div><h3>Resolution</h3><p>The pixel dimensions, such as 800 × 600. Multiply them to find the pixel count.</p></div><div><h3>Color depth</h3><p>The number of bits used to represent each pixel.</p></div><div><h3>RGB</h3><p>Three intensity values in red, green, blue order. Each value is often 0 to 255.</p></div></div><div class="fm-table-wrap"><table><thead><tr><th>RGB value</th><th>Color</th><th>Reason</th></tr></thead><tbody><tr><td>255, 0, 0</td><td>Red</td><td>Red is at maximum intensity.</td></tr><tr><td>255, 255, 0</td><td>Yellow</td><td>Red and green light combine.</td></tr><tr><td>0, 0, 0</td><td>Black</td><td>All three channels are at zero.</td></tr></tbody></table></div><p class="fm-note">Uncompressed image size in bits = width × height × color depth. More pixels or more bits per pixel usually improve what the file can represent, but they also increase its size.</p></section>`,
    },
    practice("image-practice", "Image practice", "Practice pixels, RGB, and image size", "Complete five activities using the image rules from the previous lesson.", [
      item("Count pixels", "A 20 × 10 image contains how many pixels?", ["200", "30", "2,000"], 0, "Calculate pixel count", "20 multiplied by 10 is 200 pixels.", "Multiply width by height."),
      item("Calculate bits", "A 200-pixel image uses 8 bits per pixel. What is its uncompressed size?", ["1,600 bits", "208 bits", "25 bits"], 0, "Calculate image representation size", "200 × 8 = 1,600 bits.", "Multiply pixel count by color depth."),
      item("Read RGB", "Which RGB value represents bright red?", ["255, 0, 0", "0, 255, 0", "0, 0, 255"], 0, "Interpret RGB", "Maximum red with no green or blue produces bright red.", "Read the channels in red, green, blue order."),
      item("Increase resolution", "An image changes from 20 × 10 to 40 × 20. What happens to its pixel count?", ["It becomes four times as large", "It doubles", "It stays the same"], 0, "Reason about resolution", "Both dimensions double, so the pixel-count factor is 2 × 2 = 4.", "Calculate the pixel count before and after the change."),
      item("Explain a trade-off", "What usually happens when color depth increases?", ["More possible colors and a larger uncompressed file", "Fewer colors and a smaller file", "No representation change"], 0, "Explain color-depth trade-offs", "More bits per pixel create more possible color values and require more storage.", "Connect bits per pixel to both color choices and size."),
    ]),
    {
      id: "sound-learn",
      short: "Learn sound",
      title: "Represent sound with samples",
      summary: "Learn how capture, playback, sample settings, and compression affect an audio file.",
      minutes: 15,
      html: `<section class="fm-block"><p class="fm-label">Learn</p><h2>A computer stores measurements of a sound wave</h2><p>A <strong>microphone</strong> captures sound. The computer measures the wave at regular moments. A <strong>speaker</strong> uses the stored values to produce sound during playback.</p><div class="fm-concept-grid"><div><h3>Sample</h3><p>One recorded measurement of the wave.</p></div><div><h3>Sample rate</h3><p>The number of measurements recorded each second.</p></div><div><h3>Sample size</h3><p>The bits used to represent each measurement.</p></div><div><h3>Compression</h3><p>A method that reduces the stored or transferred file size.</p></div></div><div class="fm-table-wrap"><table><thead><tr><th>Setting change</th><th>What changes</th><th>Likely trade-off</th></tr></thead><tbody><tr><td>Higher sample rate</td><td>More measurements each second</td><td>More detail and more data</td></tr><tr><td>Higher sample size</td><td>More possible values per measurement</td><td>More precision and more data</td></tr><tr><td>More compression</td><td>Less stored data</td><td>Smaller file, with possible quality loss depending on the method</td></tr></tbody></table></div><p class="fm-note">Mono sound size in bits = sample rate × sample size × duration in seconds. Real files may also include more channels and file information.</p></section>`,
    },
    practice("sound-practice", "Sound practice", "Practice sound representation", "Complete five activities using the sound rules from the previous lesson.", [
      item("Raise sample rate", "What usually happens when sample rate increases?", ["More wave measurements and a larger uncompressed file", "Fewer measurements", "The duration becomes zero"], 0, "Explain sample-rate trade-offs", "More samples can represent the wave more closely but require more data.", "Sample rate counts measurements per second."),
      item("Raise sample size", "What usually happens when sample size increases?", ["More possible values per sample and a larger file", "Fewer possible values", "No change to stored data"], 0, "Explain sample-size trade-offs", "More bits represent each measurement with more possible values.", "Bits per sample affect both precision and size."),
      item("Calculate sound bits", "A 1-second mono clip uses 8 samples per second and 4 bits per sample. What is its uncompressed size?", ["32 bits", "12 bits", "2 bits"], 0, "Calculate sound representation size", "8 × 4 × 1 = 32 bits.", "Multiply sample rate, sample size, and duration."),
      item("Use compression", "Why compress a media file?", ["Reduce storage or transfer size", "Add missing source credit", "Convert every value to zero"], 0, "Explain compression purpose", "Compression reduces the amount of data needed to store or send the file.", "Focus on file size and transfer."),
      item("Choose a setting", "A spoken announcement must download quickly and remain understandable. What is the sensible decision?", ["Test a moderate rate and compression, then compare clarity and size", "Always choose the largest settings", "Remove the sound"], 0, "Balance quality and size", "Testing lets you choose settings that meet the purpose and size limit.", "The best setting depends on the file's purpose."),
    ]),
    {
      id: "media-record",
      short: "Record analysis",
      title: "Record a media representation check",
      summary: "Use fixed values to create checkable binary, image, and sound evidence.",
      minutes: 20,
      kind: "form",
      intro: representationBrief,
      prompt: "Complete the fixed representation brief",
      fields: [
        { name: "binary", label: "B1: Convert decimal 13 to four-bit binary and binary 0110 to decimal. Show the place values used.", type: "textarea", rows: 4, minlength: 12 },
        { name: "image", label: "I1: Record the dimensions, pixel count, color depth, and uncompressed size in bits.", type: "textarea", rows: 4, minlength: 12 },
        { name: "sound", label: "S1: Record the sample rate, sample size, duration, and uncompressed size in bits.", type: "textarea", rows: 4, minlength: 12 },
        { name: "decision", label: "D1: Choose one image setting to test. Explain what may improve and what may become worse.", type: "textarea", rows: 4, minlength: 20 },
        { name: "check", label: "Write one calculation you checked again and describe how you checked it.", type: "textarea", rows: 3, minlength: 12 },
      ],
    },
    history,
  ],
};
