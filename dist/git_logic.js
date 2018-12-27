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
    constructor(path, log_function_or_args) {
        this.silent = false;
        this._path = new path_helper_1.AbsPath(null);
        this.runcmd = this._runcmd; // allow mocking
        this.keep_color = false;
        if (path != null) {
            this._path = path;
        }
        let args = {};
        if (typeof (log_function_or_args) == "function") {
            args.log_function = log_function_or_args;
        }
        else if (log_function_or_args != undefined) {
            args = log_function_or_args;
        }
        if (args.silent) {
            this.log = () => { };
            this.error = () => { };
            this.silent = true;
        }
        else {
            this.log = args.log_function ? args.log_function : console.log;
            this.error = args.error_function ? args.error_function : console.error;
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
            this.log(dirinfo + chalk_1.default.blue("git " + [gitcmd].concat(args).join(" ")));
            let options = {};
            if (this.silent) {
                options.stdio = 'ignore';
            }
            let result = child_process_1.execFileSync('git', [gitcmd].concat(args), options); // returns stdout of executed command
            if (result != null) {
                if (this.keep_color) {
                    this.log(result.toString());
                    this.keep_color = false;
                }
                else {
                    this.log(chalk_1.default.cyan(result.toString()));
                }
            }
            return result;
        }
        catch (e) {
            this.log("e.status:", e.status);
            if (allowed_statuses.indexOf(e.status) > -1) {
                this.log(chalk_1.default.black(`git command returned with allowed status ${e.status}`));
                return "";
            }
            this.error(chalk_1.default.cyan(`git command failed: ${e}`));
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
    mv(from, to) {
        this.runcmd("mv", [from, to]);
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
    add_remote(name, url, args = {}) {
        let options = ["add", name, url];
        if (args.track_branch) {
            options = options.concat(["-t", args.track_branch]);
        }
        this.runcmd("remote", options);
    }
    remove_remote(name) {
        let options = ["remove", name];
        this.runcmd("remote", options);
    }
    rename_remote(from_name, to_name) {
        let options = ["rename", from_name, to_name];
        this.runcmd("remote", options);
    }
    get_remotes() {
        let result = [];
        let lines = this.to_lines(this.runcmd("remote", ["-v"]));
        for (let line of lines) {
            const s1 = line.split("\t");
            const name = s1[0];
            const s2 = s1[1].split(" ");
            const url = s2[0];
            if (s2[1] == "(fetch)") {
                result.push({ name: name, url: url });
            }
        }
        return result;
    }
    fetch(remote) {
        let options = [];
        if (remote) {
            options = options.concat([remote]);
        }
        this.runcmd("fetch", options);
    }
    clone_from(remote_url, args = {}) {
        if (remote_url instanceof path_helper_1.AbsPath) {
            remote_url = "file://" + remote_url.abspath;
        }
        if (!this.project_dir) {
            throw new ErrorInvalidPath("GitLogic: project_dir was not set");
        }
        const target_dir = this.project_dir;
        this.project_dir = target_dir.parent.validate("is_dir");
        if (!target_dir.abspath) {
            throw new Error(`unexpected state: target_dir.abspath is ${target_dir.abspath}`);
        }
        let git_args = [remote_url, target_dir.abspath];
        if (args.as_remote) {
            git_args = git_args.concat(['-o', args.as_remote]);
        }
        if (args.head_branch) {
            git_args = git_args.concat(['-b', args.head_branch]);
        }
        this.runcmd("clone", git_args);
        this.project_dir = target_dir;
    }
    git_cmd(cmd, args, allowed_statuses = []) {
        return this.to_lines(this.runcmd(cmd, args, allowed_statuses));
    }
}
exports.GitLogic = GitLogic;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0X2xvZ2ljLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2dpdF9sb2dpYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUFpRTtBQUNqRSwrQ0FBdUM7QUFFdkMsNEJBQTJCO0FBQzNCLGlDQUF5QjtBQUd6QixNQUFhLDBCQUEyQixTQUFRLEtBQUs7Q0FBSTtBQUF6RCxnRUFBeUQ7QUFDekQsTUFBYSxnQkFBaUIsU0FBUSxLQUFLO0NBQUk7QUFBL0MsNENBQStDO0FBQy9DLE1BQWEsY0FBZSxTQUFRLEtBQUs7Q0FBSTtBQUE3Qyx3Q0FBNkM7QUFDN0MsTUFBYSxzQkFBdUIsU0FBUSxLQUFLO0NBQUk7QUFBckQsd0RBQXFEO0FBRXJELElBQVksUUFPWDtBQVBELFdBQVksUUFBUTtJQUNoQixtQ0FBdUIsQ0FBQTtJQUN2QixnQ0FBb0IsQ0FBQTtJQUNwQixvQ0FBd0IsQ0FBQTtJQUN4QiwyQkFBZSxDQUFBO0lBQ2YsMkJBQWUsQ0FBQTtJQUNmLHlDQUE2QixDQUFBLENBQUMsNkNBQTZDO0FBQy9FLENBQUMsRUFQVyxRQUFRLEdBQVIsZ0JBQVEsS0FBUixnQkFBUSxRQU9uQjtBQWNELE1BQWEsUUFBUTtJQUtqQixZQUFtQixJQUFjLEVBQzdCLG9CQUE0RTtRQUh4RSxXQUFNLEdBQUcsS0FBSyxDQUFBO1FBbUNkLFVBQUssR0FBWSxJQUFJLHFCQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7UUFPbkMsV0FBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUEsQ0FBQyxnQkFBZ0I7UUFDckMsZUFBVSxHQUFZLEtBQUssQ0FBQTtRQXRDL0IsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQ2QsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUE7U0FDcEI7UUFFRCxJQUFJLElBQUksR0FBNkIsRUFBRSxDQUFBO1FBRXZDLElBQUksT0FBTyxDQUFDLG9CQUFvQixDQUFDLElBQUksVUFBVSxFQUFFO1lBQzdDLElBQUksQ0FBQyxZ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