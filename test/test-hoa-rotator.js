/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * Test HOARotator object.
 *
 * Shoot an encoded impulse into the rotator to generate a multichannel buffer.
 * Then compare it with the JS-calculated result. Thresholding the comparison is
 * necessary because of truncation error.
 */
describe('HOARotator', function () {
  // This test is async, override timeout threshold to 5 sec.
  this.timeout(5000);

  // Threshold for sample comparison.
  var THRESHOLD = 2.9802322387695312e-8;

  var sampleRate = 48000;
  var renderLength = 256;
  var ambisonicOrder = 3;

  // Values are computed using ambix SN3D-normalization spherical harmonics.
  // [1] C. Nachbar, F. Zotter, E. Deleflie and A. Sontacchi. "Ambix - A
  //     Suggested Ambisonics Format," Ambisonics Symposium 2011. Lexington, US.
  var sphericalHarmonics_A0_E0_3oa = [1, 0, 0, 1, 0, 0, -0.5, 0,
    0.866025403784439, 0, 0, 0, 0, -0.612372435695794, 0, 0.790569415042095];
  var sphericalHarmonics_A45_E45_3oa = [1, 0.5, 0.707106781186547, 0.5,
    0.433012701892219, 0.612372435695794, 0.25, 0.612372435695795, 0,
    0.197642353760524, 0.684653196881458, 0.459279326771846, -0.176776695296637,
    0.459279326771846, 0, -0.197642353760524];
  var transformMatrix = [0.707106781186548, 0, -0.707106781186547, -0.5,
    0.707106781186548, -0.5, 0.5, 0.707106781186547, 0.5];
  var context;
  var hoaConstantBuffer;

  /**
   * Calculate the expected binaural rendering (based on SH-maxRE algorithm)
   * result from the impulse input and generate an AudioBus instance.
   * @param  {AudioBuffer} buffer     FOA SH-maxRE HRIR buffer.
   * @return {AudioBus}
   */
  function generateExpectedBusFromSphericalHarmonicsVector() {
    // We need to determine the number of channels K based on the ambisonic
    // order N where K = (N + 1)^2
    var numberOfChannels = (ambisonicOrder + 1) * (ambisonicOrder + 1);
    var generatedBus = new AudioBus(numberOfChannels, renderLength, sampleRate);

    // Assign all values in each channel to a spherical harmonic coefficient.
    for (var i = 0; i < numberOfChannels; i++) {
      var data = generatedBus.getChannelData(i);
      for (var j = 0; j < data.length; j++) {
        data[j] = sphericalHarmonics_A45_E45_3oa[i];
      }
    }

    return generatedBus;
  }

  beforeEach(function () {
    context = new OfflineAudioContext(16, renderLength, sampleRate);
    hoaConstantBuffer = createConstantBuffer(context,
      sphericalHarmonics_A0_E0_3oa, renderLength);
  });

  it('inject impulse buffer and verify convolution result.',
    function (done) {
      var constantSource = context.createBufferSource();
      var hoaRotator = Omnitone.createHOARotator(context, ambisonicOrder);

      constantSource.buffer = hoaConstantBuffer;
      hoaRotator.setRotationMatrix(transformMatrix);

      constantSource.connect(hoaRotator.input);
      hoaRotator.output.connect(context.destination);
      constantSource.start();

      context.startRendering().then(function (renderedBuffer) {
        var actualBus = new AudioBus(hoaConstantBuffer.numOfChannels, renderLength, sampleRate);
        actualBus.copyFromAudioBuffer(renderedBuffer);
        var expectedBus =
          generateExpectedBusFromSphericalHarmonicsVector();
        expect(actualBus.compareWith(expectedBus, THRESHOLD)).to.equal(true);
        done();
      });
    }
  );
});
