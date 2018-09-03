"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AbsPath = void 0;

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var path = _interopRequireWildcard(require("path"));

var fs = _interopRequireWildcard(require("fs"));

var _ = _interopRequireWildcard(require("lodash"));

var isBinaryFile = require("isbinaryfile");
/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform 
 * operations on the path (read,write,etc.)
 */


var AbsPath =
/*#__PURE__*/
function () {
  (0, _createClass2.default)(AbsPath, null, [{
    key: "fromStringAllowingRelative",
    //------------------------------------------------------------
    // Factory Methods
    //------------------------------------------------------------

    /**
     * create an absolute path from a string
     * 
     * @param pathseg - if an absolute path, ignores basedir
     *                  if relative path, uses basedir as reference point
     * @param basedir - if null: uses process.cwd() as basedir
     */
    value: function fromStringAllowingRelative() {
      var pathseg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var basedir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      if (basedir == null) {
        basedir = process.cwd();
      }

      if (pathseg) {
        if (path.isAbsolute(pathseg)) {
          return new AbsPath(pathseg);
        } else {
          return new AbsPath(path.join(basedir, pathseg));
        }
      } else {
        return new AbsPath(basedir);
      }
    }
    /**
     * @param filepath starting point
     * 
     * @returns array with an AbsPath object for each containing directory
     */

  }, {
    key: "dirHierarchy",
    value: function dirHierarchy(filepath) {
      return new AbsPath(filepath).dirHierarchy;
    } //------------------------------------------------------------
    // Path Functions
    //------------------------------------------------------------

  }]);

  /**
   * 
   * @param from a string or AbsPath specifying an absolute path, or null
   */
  function AbsPath(from) {
    (0, _classCallCheck2.default)(this, AbsPath);
    (0, _defineProperty2.default)(this, "abspath", void 0);

    if (from == null || typeof from == "undefined") {
      this.abspath = null;
    } else if (from instanceof AbsPath) {
      this.abspath = from.abspath;
    } else {
      if (path.isAbsolute(from)) {
        this.abspath = path.normalize(from);
      } else {
        this.abspath = path.normalize(path.join(process.cwd(), from));
      }
    }
  }
  /**
   * @returns normalized absolute path.  returns "" if no path set
   */


  (0, _createClass2.default)(AbsPath, [{
    key: "toString",
    value: function toString() {
      if (this.abspath == null) return "";
      return this.abspath;
    }
    /**
     * @return the basename of the path
     */

  }, {
    key: "relativeFrom",

    /**
     * @param other 
     * @param must_be_contained_in_other 
     * 
     * @returns the relative path to get to this path from other
     */
    value: function relativeFrom(other) {
      var must_be_contained_in_other = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      if (this.abspath == null) return null;
      if (other.abspath == null) return null;

      if (must_be_contained_in_other) {
        if (!this.abspath.startsWith(other.abspath)) return null;
      }

      var result = path.relative(other.abspath, this.abspath);

      if (result == "") {
        if (this.isDir) {
          result = ".";
        }
      }

      return result;
    }
    /**
     * 
     * @param other 
     * @param must_be_contained_in_other 
     *
     * @returns the relative path to get to the other path from this path
     */
    // public relativeTo(other: AbsPath, must_be_contained_in_other: boolean = false): string | null {
    //     return other.relativeFrom(this)
    // }

    /**
     * @returns true if path is set, false if it is null
     */

  }, {
    key: "add",

    /**
     * 
     * @param filepath path segment to add
     * 
     * @returns filepath with the additional segment
     */
    value: function add(filepath) {
      if (this.abspath == null) return this;
      return new AbsPath(path.join(this.abspath, filepath.toString()));
    }
    /**
     * @returns AbsPath of the parent dir. If path is root, returns AbsPath of root.
     */

  }, {
    key: "containsFile",
    //------------------------------------------------------------
    // Directory Contents
    //------------------------------------------------------------

    /**
     * @returns true if contains a file of the given name, false otherwise
     */
    value: function containsFile(filename) {
      if (this.abspath == null) return false;
      return this.add(filename).isFile;
    }
    /**
     * @returns true if contains a directory of the given name, false otherwise
     */

  }, {
    key: "containsDir",
    value: function containsDir(filename) {
      if (this.abspath == null) return false;
      return this.add(filename).isDir;
    }
    /**
     * scans upwards from the current path, looking for a file or directory with a given name
     * @param filename the fs entry to search for
     * @param can_be_dir if false, will only look for regular files.  if true, will look for directories as well.
     * @returns true if found, false if not
     */

  }, {
    key: "findUpwards",
    value: function findUpwards(filename) {
      var can_be_dir = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.dirHierarchy[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var dir = _step.value;

          if (dir.containsFile(filename)) {
            return dir.add(filename);
          } else if (can_be_dir && dir.containsDir(filename)) {
            return dir.add(filename);
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

      return new AbsPath(null);
    }
    /**
     * @returns an array of AbsPath objects, each one pointing to a containing directory
     */

  }, {
    key: "saveStrSync",

    /**
     * store new contents in the file
     * 
     * @param contents a string with the new contents
     */
    value: function saveStrSync(contents) {
      if (this.abspath == null) {
        throw new Error("can't save - abspath is null");
      }

      try {
        this.parent.mkdirs();
      } catch (e) {
        throw new Error("can't save ".concat(this.toString(), " - ").concat(e.message));
      }

      fs.writeFileSync(this.abspath, contents);
    } //------------------------------------------------------------
    // Directory contents and traversal
    //------------------------------------------------------------

    /**
     * @returns an array of AbsPath objects corresponding to each entry in the directory
     * or null if not a directory
     */

  }, {
    key: "foreachEntryInDir",

    /**
     * Traverse the directory hierarchy and activate a callback for each entry.
     * 
     * The hierarchy is traversed twice: first down, then up, allowing the callback
     * function to accumulate data on the way down and perform operations on the way up.
     * 
     * Aborts the traversal if the callback function returns true
     * 
     * @param fn callback to activate
     */
    value: function foreachEntryInDir(fn) {
      var entries = this.dirContents;
      if (entries == null) return true;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = entries[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var entry = _step2.value;

          if (entry.isDir) {
            var abort = void 0;
            abort = fn(entry, "down");
            if (abort) return true;
            abort = entry.foreachEntryInDir(fn);
            if (abort) return true;
            abort = fn(entry, "up");
            if (abort) return true;
          } else {
            var _abort = fn(entry, null);

            if (_abort) return true;
          }
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

      return false;
    } //------------------------------------------------------------
    // Modifying the filesystem
    //------------------------------------------------------------

  }, {
    key: "renameTo",
    value: function renameTo(new_name) {
      if (this.abspath == null) return;
      if (!this.exists) return;
      fs.renameSync(this.abspath, new_name);
    }
  }, {
    key: "unlinkFile",
    value: function unlinkFile() {
      this.rmFile();
    }
  }, {
    key: "rmFile",
    value: function rmFile() {
      if (this.abspath == null) {
        throw new Error("rmFile - path is not set");
      }

      if (!this.isFile) {
        throw new Error("rmFile - {$this.filepath} is not a file");
      }

      fs.unlinkSync(this.abspath);
    } //------------------------------------------------------------
    // Directory creation and removal
    //------------------------------------------------------------

  }, {
    key: "mkdirs",
    value: function mkdirs() {
      if (this.abspath == null) throw new Error("can't mkdirs for null abspath");
      if (this.exists) return;
      if (this.isRoot) return;
      var parent = this.parent;

      if (parent.exists && !parent.isDir && !parent.isSymLink) {
        throw new Error("".concat(parent.toString(), " exists and is not a directory or symlink"));
      } else {
        parent.mkdirs();
      }

      fs.mkdirSync(this.parent.realpath.add(this.basename).toString());
    }
  }, {
    key: "rmrfdir",
    value: function rmrfdir(must_match) {
      var remove_self = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
      if (this.abspath == null) return;
      if (!this.isDir) return;

      if (remove_self && !this.abspath.match(must_match)) {
        throw new Error("".concat(this.abspath, " does not match ").concat(must_match, " - aborting delete operation"));
      }

      this.foreachEntryInDir(function (p, direction) {
        if (p.abspath == null) return;

        if (!p.abspath.match(must_match)) {
          throw new Error("".concat(p.abspath, " does not match ").concat(must_match, " - aborting delete operation"));
        }

        if (direction == "up" || direction == null) {
          if (p.isDir) {
            fs.rmdirSync(p.abspath);
          } else {
            fs.unlinkSync(p.abspath);
          }
        }
      });

      if (remove_self) {
        fs.rmdirSync(this.abspath);
      }
    } //------------------------------------------------------------
    // File version naming
    //
    // (assumes a numeric suffix describing the version
    //  e.g:  "myfile.txt.3" is version 3 of "myfile.txt")
    //
    // Useful for keeping a backup of a file before modifying it.
    //------------------------------------------------------------

  }, {
    key: "renameToNextVer",
    value: function renameToNextVer() {
      var current_max_ver = this.maxVer;
      var newname;

      if (current_max_ver == null) {
        newname = this.abspath + ".1";
      } else {
        newname = this.abspath + ".".concat(current_max_ver + 1);
      }

      this.renameTo(newname);
      return newname;
    }
  }, {
    key: "basename",
    get: function get() {
      if (this.abspath == null) return "";
      return path.basename(this.abspath);
    }
  }, {
    key: "isSet",
    get: function get() {
      return this.abspath != null;
    }
  }, {
    key: "parent",
    get: function get() {
      if (this.abspath == null) return this;
      var parent_dir = path.dirname(this.abspath);
      return new AbsPath(parent_dir);
    } //------------------------------------------------------------
    // Recognition
    //------------------------------------------------------------

    /**
     * @returns true if root directory of the filesystem, false otherwise
     */

  }, {
    key: "isRoot",
    get: function get() {
      if (this.abspath == null) return false;
      return this.abspath == path.parse(this.abspath).root;
    }
    /**
     * @returns true if path is found in the filesystem, false otherwise
     */

  }, {
    key: "exists",
    get: function get() {
      if (this.abspath == null) return false;

      try {
        fs.lstatSync(this.abspath);
        return true;
      } catch (e) {
        return false;
      }
    }
    /**
     * @returns true if a normal file, false otherwise
     */

  }, {
    key: "isFile",
    get: function get() {
      if (this.abspath == null) return false;

      try {
        return fs.lstatSync(this.abspath).isFile();
      } catch (e) {
        return false;
      }
    }
    /**
     * @returns true if a directory, false otherwise
     */

  }, {
    key: "isDir",
    get: function get() {
      if (this.abspath == null) return false;

      try {
        return fs.lstatSync(this.abspath).isDirectory();
      } catch (e) {
        return false;
      }
    }
    /**
     * @returns true if a symbolic link, false otherwise
     */

  }, {
    key: "isSymLink",
    get: function get() {
      if (this.abspath == null) return false;

      try {
        return fs.lstatSync(this.abspath).isSymbolicLink();
      } catch (e) {
        return false;
      }
    }
    /**
     * see https://www.npmjs.com/package/isbinaryfile
     * 
     * @returns true if the file is binary, false otherwise
     */

  }, {
    key: "isBinaryFile",
    get: function get() {
      if (this.abspath == null) return false;
      if (!this.isFile) return false;
      return isBinaryFile.sync(this.abspath);
    }
  }, {
    key: "dirHierarchy",
    get: function get() {
      var current = this;
      var result = [];
      var allowed_depth = 30;

      do {
        result.push(current);
        current = current.parent;
      } while (allowed_depth-- > 0 && !current.isRoot && current.abspath != current.parent.abspath);

      result.push(current.parent);
      return result;
    } //------------------------------------------------------------
    // Symbolic Link Processing
    //------------------------------------------------------------

    /**
     * @returns an AbsPath pointing to the target of the symbolic link
     */

  }, {
    key: "symLinkTarget",
    get: function get() {
      if (this.abspath == null) return this;
      if (!this.isSymLink) return this;
      return new AbsPath(fs.readlinkSync(this.abspath).toString());
    }
    /**
     * @returns an AbsPath with symbolic links completely resolved
     */

  }, {
    key: "realpath",
    get: function get() {
      if (this.abspath == null) return this;
      return new AbsPath(fs.realpathSync(this.abspath));
    } //------------------------------------------------------------
    // File Contents
    //------------------------------------------------------------

    /**
     * @returns file contents as an array of strings
     */

  }, {
    key: "contentsLines",
    get: function get() {
      return this.contentsString.split('\n');
    }
    /**
     * @returns file contents as an array of strings
     */

  }, {
    key: "contentsString",
    get: function get() {
      if (this.abspath == null || !this.isFile) return "";
      return fs.readFileSync(this.abspath, 'utf8');
    }
    /**
     * @returns file contents as a buffer object
     */

  }, {
    key: "contentsBuffer",
    get: function get() {
      if (this.abspath == null || !this.isFile) return new Buffer(0);
      return fs.readFileSync(this.abspath);
    }
    /**
     * @returns parsed contents of a JSON file or null if not a JSON file
     */

  }, {
    key: "contentsFromJSON",
    get: function get() {
      if (this.abspath == null || !this.isFile) return null;
      var buf = this.contentsBuffer;

      try {
        return JSON.parse(buf.toString());
      } catch (e) {
        return null;
      }
    }
  }, {
    key: "dirContents",
    get: function get() {
      if (this.abspath == null) return null;
      if (!this.isDir) return null;
      var result = [];
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = fs.readdirSync(this.abspath)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var entry = _step3.value;
          result.push(this.add(entry));
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
  }, {
    key: "maxVer",
    get: function get() {
      var existing_versions = this.existingVersions;
      if (existing_versions == null) return null;

      var max = _.max(existing_versions);

      if (max == undefined) return null;
      return max;
    }
  }, {
    key: "existingVersions",
    get: function get() {
      if (this.abspath == null) return null;
      if (!this.exists) return null;
      var regex = new RegExp("".concat(this.abspath, ".([0-9]+)"));
      var existing = this.parent.dirContents;

      var matching = _.map(existing, function (el) {
        var matches = el.toString().match(regex);
        if (matches == null) return null;
        return parseInt(matches[1]);
      });

      var nums = _.filter(matching, function (e) {
        return e != null;
      });

      return _.sortBy(nums);
    }
  }]);
  return AbsPath;
}();

exports.AbsPath = AbsPath;