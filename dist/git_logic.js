"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_helper_1 = require("./path_helper");
const _ = require("lodash");
const chalk_1 = require("chalk");
class ErrorNotConnectedToProject extends Error {
}
exports.ErrorNotConnectedToProject = ErrorNotConnectedToProject;
class ErrorInvalidPath extends Error {
}
exports.ErrorInvalidPath = ErrorInvalidPath;
class ErrorAddFailed extends Error {
}
exports.ErrorAddFailed = ErrorAddFailed;
class ErrorCheckIgnoreFailed extends Error {
}
exports.ErrorCheckIgnoreFailed = ErrorCheckIgnoreFailed;
var GitState;
(function (GitState) {
    GitState["Undefined"] = "Undefined";
    GitState["NonRepo"] = "Non Repo";
    GitState["NoCommits"] = "No Commits";
    GitState["Dirty"] = "Dirty";
    GitState["Clean"] = "Clean";
    GitState["OpInProgress"] = "OpInProgress"; // a rebase or merge operation is in progress
})(GitState = exports.GitState || (exports.GitState = {}));
class GitLogic {
    constructor(path) {
        this._path = new path_helper_1.AbsPath(null);
        this.runcmd = this._runcmd; // allow mocking
        this.keep_color = false;
        if (path != null) {
            this._path = path;
        }
    }
    auto_connect() {
        let gitroot = new path_helper_1.AbsPath(process.cwd()).findUpwards(".git", true).parent;
        if (!gitroot.isDir) {
            throw "not in git repo";
        }
        this.project_dir = gitroot;
    }
    get project_dir() { return this._path; }
    set project_dir(path) {
        this._path = path;
    }
    _runcmd(gitcmd, args = [], allowed_statuses = []) {
        let old_dir = null;
        if (this._path.abspath == null) {
            throw new ErrorNotConnectedToProject("GitLogic: command executed before setting project_dir");
        }
        if (!this._path.isDir) {
            throw new ErrorInvalidPath("GitLogic: project_dir is not an existing directory");
        }
        try {
            let dirinfo = "";
            try {
                if (process.cwd() != this._path.abspath) {
                    old_dir = process.cwd();
                    process.chdir(this._path.abspath);
                    dirinfo = chalk_1.default.blue(`(in ${process.cwd()}) `);
                }
                else {
                    dirinfo = chalk_1.default.black(`(in ${process.cwd()}) `);
                }
            }
            catch (e) { // process.cwd() throws an error if the current directory does not exist
                process.chdir(this._path.abspath);
            }
            console.log(dirinfo + chalk_1.default.blue("git " + [gitcmd].concat(args).join(" ")));
            let result = child_process_1.execFileSync('git', [gitcmd].concat(args));
            if (this.keep_color) {
                console.log(result.toString());
                this.keep_color = false;
            }
            else {
                console.log(chalk_1.default.cyan(result.toString()));
            }
            return result;
        }
        catch (e) {
            console.log("e.status:", e.status);
            if (allowed_statuses.indexOf(e.status) > -1) {
                console.log(chalk_1.default.black(`git command returned with allowed status ${e.status}`));
                return "";
            }
            console.error(chalk_1.default.cyan(`git command failed: ${e}`));
            throw e;
        }
        finally {
            if (old_dir != null) {
                process.chdir(old_dir);
            }
        }
    }
    get state() {
        if (!this._path.isSet)
            return GitState.Undefined;
        if (!this.is_repo)
            return GitState.NonRepo;
        if (!this.has_head)
            return GitState.NoCommits;
        try {
            this.merge("HEAD");
        }
        catch (e) {
            return GitState.OpInProgress;
        }
        if (this.parsed_status.length > 0)
            return GitState.Dirty;
        return GitState.Clean;
    }
    get has_head() {
        return (this.current_branch_or_null != null);
    }
    get is_repo() {
        try {
            this.status();
        }
        catch (e) {
            return false;
        }
        return true;
    }
    status() {
        this.runcmd("status");
    }
    get parsed_status() {
        return this.to_lines(this.runcmd('status', ['--porcelain']));
    }
    get stash_list() {
        return this.to_lines(this.runcmd('stash', ['list']));
    }
    get stash_count() {
        return this.stash_list.length;
    }
    stash_with_untracked_excluding(dir_to_exclude) {
        let stashcount = this.stash_count;
        let output = this.runcmd("stash", ["push", "--include-untracked", "-m", "proj-maker-auto-stash", "--", `:(exclude)${dir_to_exclude}`]);
        // let output = this.runcmd("stash", ["push", "--include-untracked", "-m", "proj-maker-auto-stash", "--", ":(exclude)new_unit"])
        return (this.stash_count > stashcount);
    }
    // public stash_with_untracked() : boolean {
    //     let objname = this.runcmd("stash", ["create", "--include-untracked"])
    //     if ( objname == "") {
    //         return false
    //     }
    //     this.runcmd("stash", ["store", "-m", "proj-maker auto-stash", objname])
    //     return true
    // }
    stash_pop() {
        this.runcmd("stash", ["pop"]);
    }
    init() {
        this.runcmd("init");
    }
    get current_branch_or_null() {
        try {
            return this.runcmd("rev-parse", ["--abbrev-ref", "HEAD"]).toString().trim();
        }
        catch (e) {
            return null;
        }
    }
    get current_branch() {
        return this.current_branch_or_null || "";
    }
    show_branching_graph() {
        this.keep_color = true;
        this.runcmd("-c", ["color.ui=always", "log", "--graph", "--format='%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset%n'", "--abbrev-commit", "--date=relative", "--branches"]);
    }
    create_branch(branch_name, branching_point) {
        let result = this.runcmd("checkout", ["-b", branch_name, branching_point]).toString().trim();
        // this.runcmd("lgb")
        this.show_branching_graph();
        return result;
    }
    delete_branch(branch_name) {
        return this.runcmd("branch", ["-D", branch_name]).toString().trim();
    }
    checkout(branch_name) {
        this.runcmd("checkout", [branch_name]);
        this.show_branching_graph();
    }
    checkout_dir_from_branch(dir, branch_name) {
        this.runcmd("checkout", [branch_name, "--", dir]);
    }
    set_branch_description(branch, description) {
        this.runcmd('config', [`branch.${branch}.description`, description]);
    }
    get_branch_description(branch) {
        return this.to_lines(this.runcmd('config', [`branch.${branch}.description`]));
    }
    merge(branch_name) {
        this.runcmd("merge", [branch_name]);
        if (branch_name != "HEAD")
            this.show_branching_graph();
    }
    rebase_branch_from_point_onto(branch, from_point, onto) {
        let result = this.runcmd("rebase", ["--onto", onto, from_point, branch]);
        this.show_branching_graph();
        return result;
    }
    get commit_count() {
        try {
            return parseInt(this.runcmd("rev-list", ["--count", "HEAD"]).toString());
        }
        catch (e) {
            return 0;
        }
    }
    get_tags_matching(pattern) {
        return this.to_lines(this.runcmd("tag", ["-l", pattern]));
    }
    to_lines(buf) {
        let result;
        if (buf instanceof Buffer) {
            result = buf.toString().split("\n");
        }
        else if (buf instanceof Array) {
            result = buf;
        }
        else {
            result = buf.split("\n");
        }
        return _.filter(result, (s) => { return s.length > 0; });
    }
    get_files_in_commit(commit) {
        return this.to_lines(this.runcmd("diff-tree", ["--no-commit-id", "--name-only", "-r", commit]));
    }
    create_tag(tagname) {
        this.runcmd("tag", [tagname]);
    }
    move_tag_to_head(tagname) {
        this.runcmd("tag", ["-d", tagname]);
        this.runcmd("tag", [tagname]);
    }
    move_tag(tagname, ref) {
        this.runcmd("tag", ["-d", tagname]);
        this.runcmd("tag", [tagname, ref]);
    }
    add(path) {
        let paths;
        if (path instanceof Array) {
            paths = path;
        }
        else {
            paths = [path];
        }
        try {
            this.runcmd("add", paths);
        }
        catch (e) {
            throw new ErrorAddFailed(e.message);
        }
    }
    ls_files_as_abspath() {
        let files = this.ls_files();
        let result = [];
        for (let file of files) {
            result.push(this.project_dir.add(file));
        }
        return result;
    }
    ls_files() {
        let files = this.to_lines(this.runcmd("ls-files"));
        return files;
    }
    check_ignore(path) {
        let lines;
        let abspath = new path_helper_1.AbsPath(path).realpath.abspath;
        if (abspath == null) {
            throw new ErrorInvalidPath(path);
        }
        try {
            lines = this.to_lines(this.runcmd("check-ignore", [abspath], [1]));
        }
        catch (e) {
            throw new ErrorCheckIgnoreFailed(e.message);
        }
        return lines.indexOf(abspath) > -1;
    }
    commit(comment) {
        this.runcmd("commit", ["-m", comment]);
    }
    commit_allowing_empty(comment) {
        this.runcmd("commit", ["--allow-empty", "-m", comment]);
    }
}
exports.GitLogic = GitLogic;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0X2xvZ2ljLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2dpdF9sb2dpYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUE0QztBQUM1QywrQ0FBdUM7QUFFdkMsNEJBQTJCO0FBQzNCLGlDQUF5QjtBQUd6QixNQUFhLDBCQUEyQixTQUFRLEtBQUs7Q0FBSTtBQUF6RCxnRUFBeUQ7QUFDekQsTUFBYSxnQkFBaUIsU0FBUSxLQUFLO0NBQUk7QUFBL0MsNENBQStDO0FBQy9DLE1BQWEsY0FBZSxTQUFRLEtBQUs7Q0FBSTtBQUE3Qyx3Q0FBNkM7QUFDN0MsTUFBYSxzQkFBdUIsU0FBUSxLQUFLO0NBQUk7QUFBckQsd0RBQXFEO0FBRXJELElBQVksUUFPWDtBQVBELFdBQVksUUFBUTtJQUNoQixtQ0FBdUIsQ0FBQTtJQUN2QixnQ0FBb0IsQ0FBQTtJQUNwQixvQ0FBd0IsQ0FBQTtJQUN4QiwyQkFBZSxDQUFBO0lBQ2YsMkJBQWUsQ0FBQTtJQUNmLHlDQUE2QixDQUFBLENBQUMsNkNBQTZDO0FBQy9FLENBQUMsRUFQVyxRQUFRLEdBQVIsZ0JBQVEsS0FBUixnQkFBUSxRQU9uQjtBQUVELE1BQWEsUUFBUTtJQUNqQixZQUFtQixJQUFjO1FBY3pCLFVBQUssR0FBWSxJQUFJLHFCQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7UUFPbkMsV0FBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUEsQ0FBQyxnQkFBZ0I7UUFDckMsZUFBVSxHQUFZLEtBQUssQ0FBQTtRQXJCL0IsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQ2QsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUE7U0FDcEI7SUFDTCxDQUFDO0lBRU0sWUFBWTtRQUNmLElBQUksT0FBTyxHQUFHLElBQUkscUJBQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQTtRQUN6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