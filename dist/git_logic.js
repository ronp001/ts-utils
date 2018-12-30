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
        this._old_dir = null;
        this._paths_to_files_in_repo = undefined;
        this._ignored_files_cache = {};
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
    _chdir_to_repo() {
        if (this._old_dir != null) {
            throw new Error("_chdir_to_repo called twice without _restore_dir");
        }
        if (!this._path.isDir) {
            throw new ErrorInvalidPath("GitLogic: project_dir is not an existing directory");
        }
        let dirinfo = "";
        try {
            if (process.cwd() != this._path.abspath) {
                this._old_dir = process.cwd();
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
        return dirinfo;
    }
    _restore_dir() {
        if (this._old_dir) {
            process.chdir(this._old_dir);
        }
        this._old_dir = null;
    }
    _runcmd(gitcmd, args = [], allowed_statuses = [], kwargs = {}) {
        try {
            const dirinfo = this._chdir_to_repo();
            this.log(dirinfo + chalk_1.default.blue("git " + [gitcmd].concat(args).join(" ")));
            let options = {};
            if (this.silent) {
                options.stdio = 'ignore';
            }
            if (kwargs.stdio) {
                options.stdio = kwargs.stdio;
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
            this._restore_dir();
        }
    }
    analyze_repo_contents(include_unadded) {
        this._paths_to_files_in_repo = {};
        const files = this.get_all_files_in_repo(include_unadded);
        for (const file of files) {
            const abspath = this._path.add(file);
            this._paths_to_files_in_repo[abspath.abspath] = true;
        }
    }
    fast_is_file_in_repo(abspath) {
        if (this._paths_to_files_in_repo == undefined) {
            throw Error("fast_is_file_in_repo() called before call to analyze_repo_contents()");
        }
        return this._paths_to_files_in_repo[abspath] == true;
    }
    get_all_files_in_repo(include_unadded = true) {
        let opts = ['-cm'];
        if (include_unadded) {
            opts = opts.concat(['-o', '--exclude-standard']);
        }
        const out = this._runcmd('ls-files', opts);
        return this.to_lines(out);
    }
    get_all_ignored_files() {
        try {
            this._chdir_to_repo();
            const cmd = `find ${this._path.abspath} -mindepth 1  | git check-ignore --stdin`;
            // console.log("cmd:", cmd, execSync(`find ${this._path.abspath}`).toString())
            const output = child_process_1.execSync(cmd);
            return this.to_lines(output);
        }
        finally {
            this._restore_dir();
        }
    }
    cache_ignored_files() {
        const ignored_files = this.get_all_ignored_files();
        this._ignored_files_cache = {};
        for (const file of ignored_files) {
            this._ignored_files_cache[file] = true;
        }
    }
    check_ignore(path) {
        let lines;
        let abspath = new path_helper_1.AbsPath(path).realpath.abspath;
        try {
            lines = this.to_lines(this.runcmd("check-ignore", [abspath], [1]));
        }
        catch (e) {
            throw new ErrorCheckIgnoreFailed(e.message + ` (path: ${abspath})`);
        }
        return lines.indexOf(abspath) > -1;
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
            const str = buf.toString();
            result = str ? str.split("\n") : [];
        }
        else if (buf instanceof Array) {
            result = buf;
        }
        else {
            result = buf ? buf.split("\n") : [];
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
    git_cmd(cmd, args, allowed_statuses = [], kwargs = {}) {
        return this.to_lines(this.runcmd(cmd, args, allowed_statuses, kwargs));
    }
}
exports.GitLogic = GitLogic;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0X2xvZ2ljLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2dpdF9sb2dpYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUEyRTtBQUMzRSwrQ0FBdUM7QUFFdkMsNEJBQTJCO0FBQzNCLGlDQUF5QjtBQUd6QixNQUFhLDBCQUEyQixTQUFRLEtBQUs7Q0FBSTtBQUF6RCxnRUFBeUQ7QUFDekQsTUFBYSxnQkFBaUIsU0FBUSxLQUFLO0NBQUk7QUFBL0MsNENBQStDO0FBQy9DLE1BQWEsY0FBZSxTQUFRLEtBQUs7Q0FBSTtBQUE3Qyx3Q0FBNkM7QUFDN0MsTUFBYSxzQkFBdUIsU0FBUSxLQUFLO0NBQUk7QUFBckQsd0RBQXFEO0FBRXJELElBQVksUUFPWDtBQVBELFdBQVksUUFBUTtJQUNoQixtQ0FBdUIsQ0FBQTtJQUN2QixnQ0FBb0IsQ0FBQTtJQUNwQixvQ0FBd0IsQ0FBQTtJQUN4QiwyQkFBZSxDQUFBO0lBQ2YsMkJBQWUsQ0FBQTtJQUNmLHlDQUE2QixDQUFBLENBQUMsNkNBQTZDO0FBQy9FLENBQUMsRUFQVyxRQUFRLEdBQVIsZ0JBQVEsS0FBUixnQkFBUSxRQU9uQjtBQWNELE1BQWEsUUFBUTtJQUtqQixZQUFtQixJQUFjLEVBQzdCLG9CQUE0RTtRQUh4RSxXQUFNLEdBQUcsS0FBSyxDQUFBO1FBbUNkLFVBQUssR0FBWSxJQUFJLHFCQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7UUFPbkMsV0FBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUEsQ0FBQyxnQkFBZ0I7UUFDckMsZUFBVSxHQUFZLEtBQUssQ0FBQTtRQUUzQixhQUFRLEdBQWtCLElBQUksQ0FBQTtRQXVFOUIsNEJBQXVCLEdBQWdDLFNBQVMsQ0FBQTtRQXdDaEUseUJBQW9CLEdBQStCLEVBQUUsQ0FBQTtRQXZKekQsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQ2QsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUE7U0FDcEI7UUFFRCxJQUFJ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