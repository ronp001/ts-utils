"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MockFSHelper = void 0;

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _ = _interopRequireWildcard(require("lodash"));

var _path_helper = require("./path_helper");

var _util = require("util");

var MockFSHelper =
/*#__PURE__*/
function () {
  function MockFSHelper(fs_structure = {}) {
    (0, _classCallCheck2.default)(this, MockFSHelper);
  }

  (0, _createClass2.default)(MockFSHelper, [{
    key: "addSourceDirContents",
    value: function addSourceDirContents() {
      this.addDirContents(this.src_dir);
      return this;
    }
  }, {
    key: "addFile",
    value: function addFile(file) {
      if ((0, _util.isString)(file)) {
        file = new _path_helper.AbsPath(file);
      }

      if (file.abspath == null) {
        throw "file path is null";
      }

      this.fs_structure[file.abspath] = file.contentsBuffer.toString();
      return this;
    }
  }, {
    key: "addDirContents",
    value: function addDirContents(dir) {
      var max_levels = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = (dir.dirContents || [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var entry = _step.value;

          if (entry.isFile) {
            if (entry.abspath == null) {
              throw "entry path is null";
            }

            this.fs_structure[entry.abspath] = entry.contentsBuffer.toString();
          } else if (entry.isDir && max_levels > 0) {
            this.addDirContents(entry, max_levels - 1);
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return this;
    }
  }, {
    key: "addDirs",
    value: function addDirs(dirs) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = dirs[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var dir = _step2.value;
          this.addDirContents(new _path_helper.AbsPath(dir));
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return this;
    }
  }, {
    key: "src_dir",
    get: function get() {
      return new _path_helper.AbsPath(__dirname).findUpwards("src", true);
    }
  }], [{
    key: "ls",
    value: function ls(dir) {
      var max_levels = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5;
      var with_contents_of = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
      var result = {};
      if (typeof dir == "string") dir = new _path_helper.AbsPath(dir);
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = (dir.dirContents || [])[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var entry = _step3.value;

          // console.log(entry.abspath)
          if (entry.isFile) {
            if (with_contents_of && (with_contents_of[0] == '*' || _.includes(with_contents_of, entry.abspath))) {
              result[entry.basename] = entry.contentsBuffer.toString();
            } else {
              result[entry.basename] = "<file>";
            }
          } else if (entry.isDir) {
            if (max_levels > 0) {
              result[entry.basename] = this.ls(entry, max_levels - 1, with_contents_of);
            } else {
              result[entry.basename] = "<dir>";
            }
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return result;
    }
  }]);
  return MockFSHelper;
}();

exports.MockFSHelper = MockFSHelper;