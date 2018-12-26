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
    constructor(path, log_function) {
        this._path = new path_helper_1.AbsPath(null);
        this.runcmd = this._runcmd; // allow mocking
        this.keep_color = false;
        if (path != null) {
            this._path = path;
        }
        this.log = log_function ? log_function : console.log;
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
            let result = child_process_1.execFileSync('git', [gitcmd].concat(args));
            if (this.keep_color) {
                this.log(result.toString());
                this.keep_color = false;
            }
            else {
                this.log(chalk_1.default.cyan(result.toString()));
            }
            return result;
        }
        catch (e) {
            this.log("e.status:", e.status);
            if (allowed_statuses.indexOf(e.status) > -1) {
                this.log(chalk_1.default.black(`git command returned with allowed status ${e.status}`));
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
    add_remote(name, url, track_branch) {
        let options = ["add", name, url];
        if (track_branch) {
            options = options.concat(["-t", track_branch]);
        }
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
}
exports.GitLogic = GitLogic;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0X2xvZ2ljLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2dpdF9sb2dpYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLGlEQUE0QztBQUM1QywrQ0FBdUM7QUFFdkMsNEJBQTJCO0FBQzNCLGlDQUF5QjtBQUd6QixNQUFhLDBCQUEyQixTQUFRLEtBQUs7Q0FBSTtBQUF6RCxnRUFBeUQ7QUFDekQsTUFBYSxnQkFBaUIsU0FBUSxLQUFLO0NBQUk7QUFBL0MsNENBQStDO0FBQy9DLE1BQWEsY0FBZSxTQUFRLEtBQUs7Q0FBSTtBQUE3Qyx3Q0FBNkM7QUFDN0MsTUFBYSxzQkFBdUIsU0FBUSxLQUFLO0NBQUk7QUFBckQsd0RBQXFEO0FBRXJELElBQVksUUFPWDtBQVBELFdBQVksUUFBUTtJQUNoQixtQ0FBdUIsQ0FBQTtJQUN2QixnQ0FBb0IsQ0FBQTtJQUNwQixvQ0FBd0IsQ0FBQTtJQUN4QiwyQkFBZSxDQUFBO0lBQ2YsMkJBQWUsQ0FBQTtJQUNmLHlDQUE2QixDQUFBLENBQUMsNkNBQTZDO0FBQy9FLENBQUMsRUFQVyxRQUFRLEdBQVIsZ0JBQVEsS0FBUixnQkFBUSxRQU9uQjtBQVFELE1BQWEsUUFBUTtJQUdqQixZQUFtQixJQUFjLEVBQUUsWUFBdUM7UUFlbEUsVUFBSyxHQUFZLElBQUkscUJBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQU9uQyxXQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQSxDQUFDLGdCQUFnQjtRQUNyQyxlQUFVLEdBQVksS0FBSyxDQUFBO1FBdEIvQixJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7WUFDZCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQTtTQUNwQjtRQUNELElBQUksQ0FBQyxHQUFHLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUE7SUFDeEQsQ0FBQztJQUVNLFlBQVk7UUFDZixJQUFJLE9BQU8sR0FB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