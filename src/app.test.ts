/* @preserve
  (c) 2025 lytical, inc. all rights are reserved.
  lytical(r) is a registered trademark of lytical, inc.
  please refer to your license agreement on the use of this file.
*/

import { expect } from 'chai';
import { describe } from 'mocha';

import app from './index';

describe('an app', () => {
  it('can be started', async () => {
    expect(app).exist;
  });
});
