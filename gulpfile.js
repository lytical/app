/* @preserve
  (c) 2025 lytical, inc. all rights are reserved.
  lytical(r) is a registered trademark of lytical, inc.
  please refer to your license agreement on the use of this file.
*/

const _clean = require('gulp-clean');
const _fs = require('node:fs/promises');
const _gulp = require('gulp');
const _pump = require('pump');
const _uglify = require('gulp-uglify-es');

async function remove_package_json_scripts(done) {
  const package = await require('./dist/package.json');
  delete package.scripts;
  await _fs.writeFile(
    './dist/package.json',
    JSON.stringify(package, null, 2),
  );
  done();
}

exports.post_build = _gulp.series(
  _gulp.parallel(
    (done) =>
      _pump(
        _gulp.src(['package.json', 'README.md', './src/**/*.d.ts']),
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
  ),
  remove_package_json_scripts,
);
