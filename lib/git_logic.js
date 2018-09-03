"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GitLogic = exports.GitState = exports.ErrorAddFailed = exports.ErrorInvalidPath = exports.ErrorNotConnectedToProject = void 0;

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _wrapNativeSuper2 = _interopRequireDefault(require("@babel/runtime/helpers/wrapNativeSuper"));

var _child_process = require("child_process");

var _path_helper = require("./path_helper");

var _ = _interopRequireWildcard(require("lodash"));

var _chalk = _interopRequireDefault(require("chalk"));

var ErrorNotConnectedToProject =
/*#__PURE__*/
function (_Error) {
  (0, _inherits2.default)(ErrorNotConnectedToProject, _Error);

  function ErrorNotConnectedToProject() {
    (0, _classCallCheck2.default)(this, ErrorNotConnectedToProject);
    return (0, _possibleConstructorReturn2.default)(this, (0, _getPrototypeOf2.default)(ErrorNotConnectedToProject).apply(this, arguments));
  }

  return ErrorNotConnectedToProject;
}((0, _wrapNativeSuper2.default)(Error));

exports.ErrorNotConnectedToProject = ErrorNotConnectedToProject;

var ErrorInvalidPath =
/*#__PURE__*/
function (_Error2) {
  (0, _inherits2.default)(ErrorInvalidPath, _Error2);

  function ErrorInvalidPath() {
    (0, _classCallCheck2.default)(this, ErrorInvalidPath);
    return (0, _possibleConstructorReturn2.default)(this, (0, _getPrototypeOf2.default)(ErrorInvalidPath).apply(this, arguments));
  }

  return ErrorInvalidPath;
}((0, _wrapNativeSuper2.default)(Error));

exports.ErrorInvalidPath = ErrorInvalidPath;

var ErrorAddFailed =
/*#__PURE__*/
function (_Error3) {
  (0, _inherits2.default)(ErrorAddFailed, _Error3);

  function ErrorAddFailed() {
    (0, _classCallCheck2.default)(this, ErrorAddFailed);
    return (0, _possibleConstructorReturn2.default)(this, (0, _getPrototypeOf2.default)(ErrorAddFailed).apply(this, arguments));
  }

  return ErrorAddFailed;
}((0, _wrapNativeSuper2.default)(Error));

exports.ErrorAddFailed = ErrorAddFailed;
var GitState;
exports.GitState = GitState;

(function (GitState) {
  GitState["Undefined"] = "Undefined";
  GitState["NonRepo"] = "Non Repo";
  GitState["NoCommits"] = "No Commits";
  GitState["Dirty"] = "Dirty";
  GitState["Clean"] = "Clean";
  GitState["OpInProgress"] = "OpInProgress";
})(GitState || (exports.GitState = GitState = {}));

var GitLogic =
/*#__PURE__*/
function () {
  function GitLogic(path) {
    (0, _classCallCheck2.default)(this, GitLogic);
    (0, _defineProperty2.default)(this, "_path", new _path_helper.AbsPath(null));
    (0, _defineProperty2.default)(this, "runcmd", this._runcmd);
    (0, _defineProperty2.default)(this, "keep_color", false);

    if (path != null) {
      this._path = path;
    }
  }

  (0, _createClass2.default)(GitLogic, [{
    key: "auto_connect",
    value: function auto_connect() {
      var gitroot = new _path_helper.AbsPath(process.cwd()).findUpwards(".git", true).parent;

      if (!gitroot.isDir) {
        throw "not in git repo";
      }

      this.project_dir = gitroot;
    }
  }, {
    key: "_runcmd",
    value: function _runcmd(gitcmd) {
      var args = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      var old_dir = null;

      if (this._path.abspath == null) {
        throw new ErrorNotConnectedToProject("GitLogic: command executed before setting project_dir");
      }

      if (!this._path.isDir) {
        throw new ErrorInvalidPath("GitLogic: project_dir is not an existing directory");
      }

      try {
        var dirinfo = "";

        try {
          if (process.cwd() != this._path.abspath) {
            old_dir = process.cwd();
            process.chdir(this._path.abspath);
            dirinfo = _chalk.default.blue("(in ".concat(process.cwd(), ") "));
          } else {
            dirinfo = _chalk.default.black("(in ".concat(process.cwd(), ") "));
          }
        } catch (e) {
          // process.cwd() throws an error if the current directory does not exist
          process.chdir(this._path.abspath);
        }

        console.log(dirinfo + _chalk.default.blue("git " + [gitcmd].concat(args).join(" ")));
        var result = (0, _child_process.execFileSync)('git', [gitcmd].concat(args));

        if (this.keep_color) {
          console.log(result.toString());
          this.keep_color = false;
        } else {
          console.log(_chalk.default.cyan(result.toString()));
        }

        return result;
      } catch (e) {
        console.error(_chalk.default.cyan("git command failed: ".concat(e)));
        throw e;
      } finally {
        if (old_dir != null) {
          process.chdir(old_dir);
        }
      }
    }
  }, {
    key: "status",
    value: function status() {
      this.runcmd("status");
    }
  }, {
    key: "stash_with_untracked_excluding",
    value: function stash_with_untracked_excluding(dir_to_exclude) {
      var stashcount = this.stash_count;
      var output = this.runcmd("stash", ["push", "--include-untracked", "-m", "proj-maker-auto-stash", "--", ":(exclude)".concat(dir_to_exclude)]); // let output = this.runcmd("stash", ["push", "--include-untracked", "-m", "proj-maker-auto-stash", "--", ":(exclude)new_unit"])

      return this.stash_count > stashcount;
    } // public stash_with_untracked() : boolean {
    //     let objname = this.runcmd("stash", ["create", "--include-untracked"])
    //     if ( objname == "") {
    //         return false
    //     }
    //     this.runcmd("stash", ["store", "-m", "proj-maker auto-stash", objname])
    //     return true
    // }

  }, {
    key: "stash_pop",
    value: function stash_pop() {
      this.runcmd("stash", ["pop"]);
    }
  }, {
    key: "init",
    value: function init() {
      this.runcmd("init");
    }
  }, {
    key: "show_branching_graph",
    value: function show_branching_graph() {
      this.keep_color = true;
      this.runcmd("-c", ["color.ui=always", "log", "--graph", "--format='%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset%n'", "--abbrev-commit", "--date=relative", "--branches"]);
    }
  }, {
    key: "create_branch",
    value: function create_branch(branch_name, branching_point) {
      var result = this.runcmd("checkout", ["-b", branch_name, branching_point]).toString().trim(); // this.runcmd("lgb")

      this.show_branching_graph();
      return result;
    }
  }, {
    key: "delete_branch",
    value: function delete_branch(branch_name) {
      return this.runcmd("branch", ["-D", branch_name]).toString().trim();
    }
  }, {
    key: "checkout",
    value: function checkout(branch_name) {
      this.runcmd("checkout", [branch_name]);
      this.show_branching_graph();
    }
  }, {
    key: "checkout_dir_from_branch",
    value: function checkout_dir_from_branch(dir, branch_name) {
      this.runcmd("checkout", [branch_name, "--", dir]);
    }
  }, {
    key: "set_branch_description",
    value: function set_branch_description(branch, description) {
      this.runcmd('config', ["branch.".concat(branch, ".description"), description]);
    }
  }, {
    key: "get_branch_description",
    value: function get_branch_description(branch) {
      return this.to_lines(this.runcmd('config', ["branch.".concat(branch, ".description")]));
    }
  }, {
    key: "merge",
    value: function merge(branch_name) {
      this.runcmd("merge", [branch_name]);
      if (branch_name != "HEAD") this.show_branching_graph();
    }
  }, {
    key: "rebase_branch_from_point_onto",
    value: function rebase_branch_from_point_onto(branch, from_point, onto) {
      var result = this.runcmd("rebase", ["--onto", onto, from_point, branch]);
      this.show_branching_graph();
      return result;
    }
  }, {
    key: "get_tags_matching",
    value: function get_tags_matching(pattern) {
      return this.to_lines(this.runcmd("tag", ["-l", pattern]));
    }
  }, {
    key: "to_lines",
    value: function to_lines(buf) {
      var result;

      if (buf instanceof Buffer) {
        result = buf.toString().split("\n");
      } else if (buf instanceof Array) {
        result = buf;
      } else {
        result = buf.split("\n");
      }

      return _.filter(result, function (s) {
        return s.length > 0;
      });
    }
  }, {
    key: "get_files_in_commit",
    value: function get_files_in_commit(commit) {
      return this.to_lines(this.runcmd("diff-tree", ["--no-commit-id", "--name-only", "-r", commit]));
    }
  }, {
    key: "create_tag",
    value: function create_tag(tagname) {
      this.runcmd("tag", [tagname]);
    }
  }, {
    key: "move_tag_to_head",
    value: function move_tag_to_head(tagname) {
      this.runcmd("tag", ["-d", tagname]);
      this.runcmd("tag", [tagname]);
    }
  }, {
    key: "move_tag",
    value: function move_tag(tagname, ref) {
      this.runcmd("tag", ["-d", tagname]);
      this.runcmd("tag", [tagname, ref]);
    }
  }, {
    key: "add",
    value: function add(path) {
      var paths;

      if (path instanceof Array) {
        paths = path;
      } else {
        paths = [path];
      }

      try {
        this.runcmd("add", paths);
      } catch (e) {
        throw new ErrorAddFailed(e.message);
      }
    }
  }, {
    key: "commit",
    value: function commit(comment) {
      this.runcmd("commit", ["-m", comment]);
    }
  }, {
    key: "commit_allowing_empty",
    value: function commit_allowing_empty(comment) {
      this.runcmd("commit", ["--allow-empty", "-m", comment]);
    }
  }, {
    key: "project_dir",
    get: function get() {
      return this._path;
    },
    set: function set(path) {
      this._path = path;
    }
  }, {
    key: "state",
    get: function get() {
      if (!this._path.isSet) return GitState.Undefined;
      if (!this.is_repo) return GitState.NonRepo;
      if (!this.has_head) return GitState.NoCommits;

      try {
        this.merge("HEAD");
      } catch (e) {
        return GitState.OpInProgress;
      }

      if (this.parsed_status.length > 0) return GitState.Dirty;
      return GitState.Clean;
    }
  }, {
    key: "has_head",
    get: function get() {
      return this.current_branch_or_null != null;
    }
  }, {
    key: "is_repo",
    get: function get() {
      try {
        this.status();
      } catch (e) {
        return false;
      }

      return true;
    }
  }, {
    key: "parsed_status",
    get: function get() {
      return this.to_lines(this.runcmd('status', ['--porcelain']));
    }
  }, {
    key: "stash_list",
    get: function get() {
      return this.to_lines(this.runcmd('stash', ['list']));
    }
  }, {
    key: "stash_count",
    get: function get() {
      return this.stash_list.length;
    }
  }, {
    key: "current_branch_or_null",
    get: function get() {
      try {
        return this.runcmd("rev-parse", ["--abbrev-ref", "HEAD"]).toString().trim();
      } catch (e) {
        return null;
      }
    }
  }, {
    key: "current_branch",
    get: function get() {
      return this.current_branch_or_null || "";
    }
  }, {
    key: "commit_count",
    get: function get() {
      try {
        return parseInt(this.runcmd("rev-list", ["--count", "HEAD"]).toString());
      } catch (e) {
        return 0;
      }
    }
  }]);
  return GitLogic;
}();

exports.GitLogic = GitLogic;