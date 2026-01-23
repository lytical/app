/* @preserve
  (c) 2025 lytical, inc. all rights are reserved.
  lytical(r) is a registered trademark of lytical, inc.
  please refer to your license agreement on the use of this file.
*/

import _clean from 'gulp-clean';
import _gulp from 'gulp';
import _pump from 'pump';
import _uglify from 'gulp-uglify-es';

export const post_build = _gulp.parallel(
  (done) =>
    _pump(
      _gulp.src(['package.json', 'README.md', './src/types.d.ts']),
      _gulp.dest('./dist'),
      done,
    ),
  (done) =>
    _pump(
      _gulp.src('./dist/**/*.js', { dot: true }),
      _uglify.default({
        mangle: { keep_fnames: true },
        output: { comments: 'some' },
      }),
      _gulp.dest('./dist'),
      done,
    ),
  (done) =>
    _pump(_gulp.src('./dist/**/*.map', { read: false }), _clean(), done),
);
