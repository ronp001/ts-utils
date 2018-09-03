"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var mockfs = _interopRequireWildcard(require("mock-fs"));

var fs = _interopRequireWildcard(require("fs"));

var path = _interopRequireWildcard(require("path"));

var _index = require("../index");

///<reference types="jest"/>
var simfs = new _index.MockFSHelper({
  '/link1': mockfs.symlink({
    path: '/dir1/dir11'
  }),
  '/link2': mockfs.symlink({
    path: '/base/file1'
  }),
  '/base': {
    'file1': "this is file1",
    'file2': "this is file2",
    'symlink_to_file1': mockfs.symlink({
      path: 'file1 '
    }),
    'f': "f in /",
    'inner': {
      'file-in-inner': 'this is /base/inner/file-in-inner'
    },
    'inner2': {
      'file-in-inner2': 'this is /base/inner2/file-in-inner2'
    }
  },
  '/dir1': {
    '1file1': "this is 1file1",
    'f': "f in /dir1"
  },
  '/dir1/dir11': {
    '11file1': "this is 11file1",
    '11file2': "this is 11file2",
    'f': "f in /dir1/dir11"
  },
  '/dir1/dir12': {
    '12file1': "this is 12file1",
    '12file2': "this is 12file2",
    'f': "f in /dir1/dir12"
  }
}); // Prepare path_helper.ts for inclusion in the mocked filesystem
// so that exceptions are displayed properly by jest

simfs.addFile(new _index.AbsPath(__dirname).add("../path_helper.ts"));
simfs.addDirContents(new _index.AbsPath(__dirname).add("../../node_modules/callsites"));
beforeEach(
/*#__PURE__*/
(0, _asyncToGenerator2.default)(
/*#__PURE__*/
_regenerator.default.mark(function _callee() {
  return _regenerator.default.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          mockfs(simfs.fs_structure);

        case 1:
        case "end":
          return _context.stop();
      }
    }
  }, _callee, this);
})));
afterEach(
/*#__PURE__*/
(0, _asyncToGenerator2.default)(
/*#__PURE__*/
_regenerator.default.mark(function _callee2() {
  return _regenerator.default.wrap(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          mockfs.restore();

        case 1:
        case "end":
          return _context2.stop();
      }
    }
  }, _callee2, this);
})));
describe("verifying my understanding of node's low level functions", function () {
  test('node.js path functions are working as I think they do', function () {
    expect(path.normalize('/')).toEqual('/');
    expect(path.normalize('/..')).toEqual('/');
    expect(path.normalize('a')).toEqual('a');
    expect(path.normalize('a/b/c/../d')).toEqual('a/b/d');
    expect(path.normalize('a/b/c/../d/')).toEqual('a/b/d/');
  });
});
describe("verifying my understanding of mockfs", function () {
  test('file mocks are working properly', function () {
    var contents = fs.readFileSync('/base/file1');
    expect(contents.toString()).toEqual("this is file1");
    expect(new _index.AbsPath('/base/file1').isFile).toBeTruthy(); // replace the fs mock

    mockfs({
      '/test2': 'test 2'
    });
    expect(fs.readFileSync('/test2').toString()).toEqual("test 2");
    expect(new _index.AbsPath('/base/file1').isFile).toBeFalsy();
  });
  test('fs mocks', function () {
    expect(fs.lstatSync('/base/file1').isFile()).toBeTruthy();
    expect(fs.lstatSync('/base/file2').isFile()).toBeTruthy();
    expect(fs.lstatSync('/dir1').isDirectory()).toBeTruthy();
    expect(fs.lstatSync('/dir1').isFile()).toBeFalsy();
    expect(fs.lstatSync('/dir1/1file1').isFile()).toBeTruthy();
  });
  test('mockfs({}) adds the current directory', function () {
    mockfs({});
    expect(fs.lstatSync(process.cwd()).isDirectory()).toBeTruthy();
  });
  test('path_helper is in the mocked fs', function () {
    expect(new _index.AbsPath(__dirname + "/../path_helper.ts").isFile).toBeTruthy();
  });
});
describe("AbsPath", function () {
  test('construction', function () {
    var ph = new _index.AbsPath('/');
    expect(ph).toBeInstanceOf(_index.AbsPath);
    expect(new _index.AbsPath('/').abspath).toEqual('/');
  });
  describe("paths", function () {
    test('null path', function () {
      var p = new _index.AbsPath(null);
      expect(p.isSet).toBeFalsy();
      var p2 = new _index.AbsPath('/');
      expect(p2.isSet).toBeTruthy();
    });
    test('creating from relative path', function () {
      process.chdir('/base/inner');
      expect(new _index.AbsPath('..').abspath).toEqual('/base');
      expect(new _index.AbsPath('../inner2').abspath).toEqual('/base/inner2');
      process.chdir('/base');
      expect(new _index.AbsPath('inner2').abspath).toEqual('/base/inner2');
      expect(new _index.AbsPath('./inner2').abspath).toEqual('/base/inner2');
      expect(new _index.AbsPath('.').abspath).toEqual('/base');
      expect(new _index.AbsPath('./').abspath).toEqual('/base/');
      expect(new _index.AbsPath('.//').abspath).toEqual('/base/');
      expect(new _index.AbsPath('/inner2').abspath).toEqual('/inner2');
    });
    test('factory method', function () {
      var p = _index.AbsPath.fromStringAllowingRelative();

      expect(p.isDir).toBeTruthy();
      expect(p.abspath).toEqual(process.cwd());
      p = _index.AbsPath.fromStringAllowingRelative('/');
      expect(p.abspath).toEqual('/');
      p = _index.AbsPath.fromStringAllowingRelative('..');
      expect(p.abspath).toEqual(new _index.AbsPath(process.cwd()).parent.toString());
      p = _index.AbsPath.fromStringAllowingRelative('dir1');
      expect(p.abspath).toEqual(new _index.AbsPath(process.cwd()).add('dir1').toString());
    });
    test('parent', function () {
      var ph = new _index.AbsPath('/dir1/dir11');
      expect(ph.toString()).toEqual("/dir1/dir11");
      expect(ph.parent.toString()).toEqual("/dir1");
      expect(ph.parent.parent.toString()).toEqual("/");
      expect(ph.parent.parent.parent.toString()).toEqual("/");
    });
    test('relativeTo', function () {
      var ph = new _index.AbsPath('/dir1/dir11');
      expect(ph.relativeFrom(new _index.AbsPath('/dir1'))).toEqual("dir11");
      expect(ph.relativeFrom(new _index.AbsPath('/dir1/dir11/dir111'))).toEqual("..");
      expect(ph.relativeFrom(new _index.AbsPath('/dir1'), true)).toEqual("dir11");
      expect(ph.relativeFrom(new _index.AbsPath('/dir2'))).toEqual("../dir1/dir11");
      expect(ph.relativeFrom(new _index.AbsPath('/dir2'), true)).toBeNull();
      expect(ph.relativeFrom(new _index.AbsPath('/dir1/dir11'))).toEqual('.');
    });
    test('basename', function () {
      expect(new _index.AbsPath('/inner2').basename).toEqual('inner2');
      expect(new _index.AbsPath('/inner2/').basename).toEqual('inner2');
    });
    test('add', function () {
      var p = new _index.AbsPath("/dir1");
      expect(p.add('dir2').toString()).toEqual('/dir1/dir2');
      expect(p.add('/dir2').toString()).toEqual('/dir1/dir2');
      expect(p.add('../dir2').toString()).toEqual('/dir2');
    });
  });
  describe("recognition", function () {
    test('is root', function () {
      expect(new _index.AbsPath('/').isRoot).toBeTruthy();
      expect(new _index.AbsPath('/dir1').isRoot).toBeFalsy();
      expect(new _index.AbsPath('/dir1').parent.isRoot).toBeTruthy();
    });
    test('exists', function () {
      expect(new _index.AbsPath('/').exists).toBeTruthy();
      expect(new _index.AbsPath('/dir1').exists).toBeTruthy();
      expect(new _index.AbsPath('/nosuchfile').exists).toBeFalsy();
    });
    test('isFile and isDir', function () {
      expect(new _index.AbsPath('/dir1').isDir).toBeTruthy();
      expect(new _index.AbsPath('/dir1').isFile).toBeFalsy();
      expect(new _index.AbsPath('/dir1/f').isFile).toBeTruthy();
      expect(new _index.AbsPath('/dir1/f').isDir).toBeFalsy();
      expect(new _index.AbsPath('/base/symlink_to_file1').exists).toBeTruthy();
      expect(new _index.AbsPath('/base/symlink_to_file1').isSymLink).toBeTruthy();
      expect(new _index.AbsPath('/base/symlink_to_file1').isDir).toBeFalsy();
      expect(new _index.AbsPath('/base/symlink_to_file1').isFile).toBeFalsy();
    });
    test('binary file recognition', function () {
      var p1 = new _index.AbsPath("/base/file1");
      var p2 = new _index.AbsPath("/binaryfile");
      console.log("path:", p1.toString());
      expect(p1.isFile).toBeTruthy();
      expect(p1.isBinaryFile).toBeFalsy();
      expect(p2.exists).toBeFalsy();
      fs.writeFileSync(p2.toString(), Buffer.alloc(100));
      expect(p2.isFile).toBeTruthy();
      expect(p2.isBinaryFile).toBeTruthy();
    });
  });
  describe("directory contents", function () {
    test('dir contents', function () {
      mockfs({
        '/dir1': 'f1',
        '/base': 'f2'
      }, {
        createCwd: false,
        createTmp: false
      });
      var p = new _index.AbsPath('/');
      expect(p.dirContents).toEqual([new _index.AbsPath('/base'), new _index.AbsPath('/dir1')]);
    });
    test('containsFile', function () {
      var ph = new _index.AbsPath('/base');
      expect(ph.containsFile('f')).toBeTruthy();
      expect(ph.containsFile('g')).toBeFalsy();
      ph = new _index.AbsPath('/dir1');
      expect(ph.containsFile('f')).toBeTruthy();
      ph = new _index.AbsPath(null);
      expect(ph.containsFile('f')).toBeFalsy();
    });
    test('containsDir', function () {
      var ph = new _index.AbsPath('/base');
      expect(ph.containsDir('inner')).toBeTruthy();
      expect(ph.containsDir('g')).toBeFalsy();
    });
  });
  describe("exploring the filesystem", function () {
    test('findUpwards', function () {
      var p = new _index.AbsPath('/dir1/dir12');
      expect(p.findUpwards('f').toString()).toEqual('/dir1/dir12/f');
      expect(p.findUpwards('1file1').toString()).toEqual('/dir1/1file1');
      expect(p.findUpwards('g')).toEqual(new _index.AbsPath(null));
      expect(p.findUpwards('g').toString()).toEqual("");
    });
    test('dir hierarchy', function () {
      expect(new _index.AbsPath('/dir1/dir11').dirHierarchy).toEqual([new _index.AbsPath('/dir1/dir11'), new _index.AbsPath('/dir1'), new _index.AbsPath('/')]);
      expect(_index.AbsPath.dirHierarchy('/dir1/dir11')).toEqual([new _index.AbsPath('/dir1/dir11'), new _index.AbsPath('/dir1'), new _index.AbsPath('/')]);
    });
    test('traversal', function () {
      var p = new _index.AbsPath('/');
      var found_up = {};
      var found_down = {};
      var found_file = {};
      p.foreachEntryInDir(function (e, direction) {
        // for directories, this will be called twice: once on the way down, and once on the way up.
        // for files:  the direction will be null
        if (direction == "down") {
          found_down[e.abspath] = found_down[e.abspath] ? found_down[e.abspath] + 1 : 1;
        } else if (direction == "up") {
          found_up[e.abspath] = found_up[e.abspath] ? found_up[e.abspath] + 1 : 1;
        } else {
          found_file[e.abspath] = found_file[e.abspath] ? found_file[e.abspath] + 1 : 1;
        }
      });
      console.log(found_down);
      expect(found_file['/base/inner/file-in-inner']).toEqual(1);
      expect(found_file['/dir1/dir11/f']).toEqual(1);
      expect(found_down['/base/inner']).toEqual(1);
      expect(found_up['/base/inner']).toEqual(1);
      expect(found_file['/base/inner']).toBeUndefined();
      expect(found_down['/base/inner/file-in-inner']).toBeUndefined();
      expect(found_up['/base/inner/file-in-inner']).toBeUndefined();
    });
    test('print traversal', function () {
      var p = new _index.AbsPath('/');
      p.foreachEntryInDir(function (e, direction) {
        console.log(e.toString(), direction);
      });
    });
  });
  describe('file contents', function () {
    test('contentsBuffer', function () {
      var p = new _index.AbsPath('/base/newfile');
      p.saveStrSync("line1\nline2");
      var contents = p.contentsBuffer;
      expect(contents.length).toEqual(11);
      expect(contents[0]).toEqual('l'.charCodeAt(0));
    });
    test('contentsLines', function () {
      var p = new _index.AbsPath('/base/newfile');
      p.saveStrSync("line1\nline2");
      var contents = p.contentsLines;
      expect(contents).toHaveLength(2);
      expect(contents[0]).toEqual('line1');
      expect(contents[1]).toEqual('line2');
    });
    test('contentsFromJSON', function () {
      var p = new _index.AbsPath('/base/newfile');
      p.saveStrSync(JSON.stringify({
        a: 1,
        b: 2
      }));
      var contents = p.contentsFromJSON;
      expect(contents['a']).toEqual(1);
      expect(contents['b']).toEqual(2);
    });
  });
  describe("file versions", function () {
    test('maxver', function () {
      var p = new _index.AbsPath('/base/file1');
      expect(p.existingVersions).toEqual([]);
      expect(p.maxVer).toEqual(null);
      new _index.AbsPath('/base/file1.2').saveStrSync('old version');
      expect(p.existingVersions).toEqual([2]);
      expect(p.maxVer).toEqual(2);
      new _index.AbsPath('/base/file1.1').saveStrSync('old version');
      expect(p.existingVersions).toEqual([1, 2]);
      expect(p.maxVer).toEqual(2);
      new _index.AbsPath('/base/file1.txt').saveStrSync('nothing to do with versions');
      expect(p.maxVer).toEqual(2);
      new _index.AbsPath('/base/file1.txt.1').saveStrSync('old version of other file');
      expect(p.maxVer).toEqual(2);
      new _index.AbsPath('/base/file1.1').rmFile();
      expect(p.maxVer).toEqual(2);
      expect(p.existingVersions).toEqual([2]);
      new _index.AbsPath('/base/file1.2').rmFile();
      expect(new _index.AbsPath('/base/file1.2').exists).toBeFalsy();
      expect(p.existingVersions).toEqual([]);
      expect(p.maxVer).toEqual(null);
    });
    test('renameToNextVer', function () {
      var p = new _index.AbsPath('/base/file1');
      expect(p.isFile).toBeTruthy();
      expect(new _index.AbsPath('/base/file1.1').isFile).toBeFalsy();
      p.renameToNextVer();
      expect(p.maxVer).toEqual(null);
      expect(p.isFile).toBeFalsy();
      expect(new _index.AbsPath('/base/file1.1').isFile).toBeTruthy();
      p.saveStrSync("new contents");
      expect(p.isFile).toBeTruthy();
      expect(new _index.AbsPath('/base/file1.1').isFile).toBeTruthy();
      expect(new _index.AbsPath('/base/file1.2').isFile).toBeFalsy();
      p.renameToNextVer();
      expect(new _index.AbsPath('/base/file1').isFile).toBeFalsy();
      expect(new _index.AbsPath('/base/file1.1').isFile).toBeTruthy();
      expect(new _index.AbsPath('/base/file1.2').isFile).toBeTruthy();
      expect(new _index.AbsPath('/base/file1.2').contentsLines).toEqual(['new contents']);
    });
  });
  describe("file content", function () {
    test('reading and writing content', function () {});
  });
  describe("dir creation and removal", function () {
    test('mkdirs', function () {
      var p = new _index.AbsPath("/l1/l2/l3/l4/l5");
      expect(p.isDir).toBeFalsy();
      expect(function () {
        p.mkdirs();
      }).not.toThrow();
      expect(p.parent.toString()).toEqual("/l1/l2/l3/l4");
      expect(p.parent.isDir).toBeTruthy();
      expect(p.isDir).toBeTruthy();
      var f = p.add('file');
      f.saveStrSync('contents');
      var p2 = new _index.AbsPath("/l1/l2/l3/l4/l5/file/l6");
      expect(function () {
        p2.mkdirs();
      }).toThrow(/exists and is not a directory/);
    });
    test('mkdirs via symlink', function () {
      var p = '/link1/dir111/dir1111';
      expect(new _index.AbsPath(p).exists).toBeFalsy();
      expect(function () {
        new _index.AbsPath(p).mkdirs();
      }).not.toThrow();
      expect(new _index.AbsPath(p).isDir).toBeTruthy();
    });
    test('mkdirs to illegal path', function () {
      var p = '/base/file1/d1';
      expect(new _index.AbsPath(p).exists).toBeFalsy();
      expect(function () {
        new _index.AbsPath(p).mkdirs();
      }).toThrow();
      expect(new _index.AbsPath(p).exists).toBeFalsy();
    });
    test('mkdirs to illegal path via symlink', function () {
      var p = '/link2/d1';
      expect(new _index.AbsPath(p).exists).toBeFalsy();
      expect(function () {
        new _index.AbsPath(p).mkdirs();
      }).toThrow();
      expect(new _index.AbsPath(p).exists).toBeFalsy();
    });
    test('rmrfdir', function () {
      var p = new _index.AbsPath('/base');
      expect(p.exists).toBeTruthy();
      expect(function () {
        p.rmrfdir(/not_base/, true);
      }).toThrow(/does not match/);
      expect(function () {
        p.rmrfdir(/^\/base/, true);
      }).not.toThrow();
      expect(p.exists).toBeFalsy();
    });
  });
});