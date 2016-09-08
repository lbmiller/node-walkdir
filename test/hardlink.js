var fs = require('fs');
var path = require('path');
var test = require('tape'),
walkdir = require('../walkdir.js');

// Make sure hard linked files are aggressively reported when requested.
// Git doesn't recognize hard links, so have to create them as part of the test.


// Create 3 files which are all hard links to the same contents:
// file1
// file2
// deeper/file1
function prepTest(dir, callback) {
  var file1 = dir + '/file1';
  var file2 = dir + '/file2';
  var subdir = dir + '/deeper';
  var file1b = subdir + '/file1';
  fs.mkdir(dir, function(err) {
    if (err) return callback(err);
    fs.mkdir(subdir, function(err) {
      if (err) return callback(err);
      fs.writeFile(file1, "contents", function(err) {
        if (err) return callback(err);
        fs.link(file1, file2, function(err) {
          if (err) return callback(err);
          fs.link(file1, file1b, callback);
        });
      });
    });
  });
}

function cleanup(dir, callback) {
  var subdir = dir + '/deeper';
  fs.unlink(subdir + '/file1', function(err) {
    // ignore error removing deeper/file1
    fs.unlink(dir + '/file1', function(err) {
      // ignore error removing file1
      fs.unlink(dir + '/file2', function(err) {
        // ignore error removing file2
        fs.rmdir(subdir, function(err) {
          // ignore error removing deeper
          fs.rmdir(dir, callback);
        });
      });
    });
  });
}

function expectFiles(t, paths, expectedPaths) {
  t.equal(paths.length, expectedPaths.length, 'should find the right number of files');
  expectedPaths.forEach(function(exp) {
    var shortname = path.relative(__dirname, exp);
    t.ok(paths.indexOf(exp) !== -1, 'expected ' + shortname);
  });
}

function runTest(t, opts, hlinkDir, expectedPaths) {
  prepTest(hlinkDir, function(err) {
    if (err) {
      t.equal(err, null, 'test prep should have created hard links');
      cleanup(hlinkDir, function() {
        return t.end();
      });
      return;
    }

    var links = [],paths = [],failures = [],errors = [];

    var emitter = walkdir(__dirname+'/dir/hardlinks', opts);

    emitter.on('path',function(path,stat){
      paths.push(path);
    });

    emitter.on('link',function(path,stat){
      links.push(path);
    });

    emitter.on('error',function(path,err){
      console.log('error!!', arguments);
      errors.push(arguments);
    });

    emitter.on('fail',function(path,err){
      failures.push(path);
    });

    emitter.on('end',function(){

      t.equal(errors.length,0,'should have no errors');
      t.equal(failures.length,0,'should have no failures');
      expectFiles(t, paths, expectedPaths);
      cleanup(hlinkDir, function(err) {
        t.equal(err, null, 'should have no errors during cleanup');
        t.end();
      });

    });
  });
};

test('hard links report_hard_links=false',function(t){
  var hlinkDir = __dirname + '/dir/hardlinks';
  var exp = [
    hlinkDir + '/file1',
    hlinkDir + '/file2',
    hlinkDir + '/deeper'
  ];
  runTest(t, {}, hlinkDir, exp);
});

test('hard links report_hard_links=true',function(t){
  var hlinkDir = __dirname + '/dir/hardlinks';
  var exp = [
    hlinkDir + '/file1',
    hlinkDir + '/file2',
    hlinkDir + '/deeper',
    hlinkDir + '/deeper/file1'
  ];
  runTest(t, {report_hard_links: true}, hlinkDir, exp);
});
