import { execFileSync } from "child_process"
import { AbsPath } from "./path_helper"
import { isArray } from "util";
import * as _ from "lodash"
import chalk from "chalk"


export class ErrorNotConnectedToProject extends Error { }
export class ErrorInvalidPath extends Error { }
export class ErrorAddFailed extends Error { }
export class ErrorCheckIgnoreFailed extends Error { }

export enum GitState {
    Undefined = "Undefined", // project path was not set
    NonRepo = "Non Repo", // project path is not in a git repo
    NoCommits = "No Commits", // git repo does not have any commits yet
    Dirty = "Dirty", // there are uncommitted changes
    Clean = "Clean", // no uncommitted changes
    OpInProgress = "OpInProgress" // a rebase or merge operation is in progress
}

export interface RemoteInfo {
    name: string,
    url: string
}


export class GitLogic {
    private log: (...args: any[]) => void

    public constructor(path?: AbsPath, log_function?: (...args: any[]) => void) {
        if (path != null) {
            this._path = path
        }
        this.log = log_function ? log_function : console.log
    }

    public auto_connect() {
        let gitroot = new AbsPath(process.cwd()).findUpwards(".git", true).parent
        if (!gitroot.isDir) {
            throw "not in git repo"
        }
        this.project_dir = gitroot
    }

    private _path: AbsPath = new AbsPath(null)

    public get project_dir() { return this._path }
    public set project_dir(path: AbsPath) {
        this._path = path
    }

    public runcmd = this._runcmd // allow mocking
    private keep_color: boolean = false

    private _runcmd(gitcmd: string, args: string[] = [], allowed_statuses: number[] = []): Buffer | string | string[] {
        let old_dir: string | null = null
        if (this._path.abspath == null) {
            throw new ErrorNotConnectedToProject("GitLogic: command executed before setting project_dir")
        }
        if (!this._path.isDir) {
            throw new ErrorInvalidPath("GitLogic: project_dir is not an existing directory")
        }
        try {
            let dirinfo = ""
            try {
                if (process.cwd() != this._path.abspath) {
                    old_dir = process.cwd()
                    process.chdir(this._path.abspath)
                    dirinfo = chalk.blue(`(in ${process.cwd()}) `)
                } else {
                    dirinfo = chalk.black(`(in ${process.cwd()}) `)
                }
            } catch (e) { // process.cwd() throws an error if the current directory does not exist
                process.chdir(this._path.abspath)
            }
            this.log(dirinfo + chalk.blue("git " + [gitcmd].concat(args).join(" ")))
            let result = execFileSync('git', [gitcmd].concat(args))
            if (this.keep_color) {
                this.log(result.toString())
                this.keep_color = false
            } else {
                this.log(chalk.cyan(result.toString()))
            }
            return result
        } catch (e) {
            this.log("e.status:", e.status)
            if (allowed_statuses.indexOf(e.status) > -1) {
                this.log(chalk.black(`git command returned with allowed status ${e.status}`))
                return ""
            }
            console.error(chalk.cyan(`git command failed: ${e}`))
            throw e
        } finally {
            if (old_dir != null) {
                process.chdir(old_dir)
            }
        }
    }

    public get state(): GitState {
        if (!this._path.isSet) return GitState.Undefined
        if (!this.is_repo) return GitState.NonRepo
        if (!this.has_head) return GitState.NoCommits
        try {
            this.merge("HEAD")
        } catch (e) {
            return GitState.OpInProgress
        }
        if (this.parsed_status.length > 0) return GitState.Dirty
        return GitState.Clean
    }

    public get has_head(): boolean {
        return (this.current_branch_or_null != null)
    }

    public get is_repo(): boolean {
        try {
            this.status()
        } catch (e) {
            return false
        }
        return true
    }

    public status() {
        this.runcmd("status")
    }

    public get parsed_status(): string[] {
        return this.to_lines(this.runcmd('status', ['--porcelain']))
    }

    public get stash_list(): string[] {
        return this.to_lines(this.runcmd('stash', ['list']))
    }

    public get stash_count(): number {
        return this.stash_list.length
    }

    public stash_with_untracked_excluding(dir_to_exclude: string): boolean {
        let stashcount = this.stash_count
        let output = this.runcmd("stash", ["push", "--include-untracked", "-m", "proj-maker-auto-stash", "--", `:(exclude)${dir_to_exclude}`])
        // let output = this.runcmd("stash", ["push", "--include-untracked", "-m", "proj-maker-auto-stash", "--", ":(exclude)new_unit"])
        return (this.stash_count > stashcount)
    }
    // public stash_with_untracked() : boolean {
    //     let objname = this.runcmd("stash", ["create", "--include-untracked"])
    //     if ( objname == "") {
    //         return false
    //     }
    //     this.runcmd("stash", ["store", "-m", "proj-maker auto-stash", objname])
    //     return true
    // }

    public stash_pop() {
        this.runcmd("stash", ["pop"])
    }
    public init() {
        this.runcmd("init")
    }

    public get current_branch_or_null(): string | null {
        try {
            return this.runcmd("rev-parse", ["--abbrev-ref", "HEAD"]).toString().trim()
        } catch (e) {
            return null
        }
    }

    public get current_branch(): string {
        return this.current_branch_or_null || ""
    }

    public show_branching_graph() {
        this.keep_color = true
        this.runcmd("-c", ["color.ui=always", "log", "--graph", "--format='%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset%n'", "--abbrev-commit", "--date=relative", "--branches"])
    }

    public create_branch(branch_name: string, branching_point: string) {
        let result = this.runcmd("checkout", ["-b", branch_name, branching_point]).toString().trim()
        // this.runcmd("lgb")
        this.show_branching_graph()
        return result
    }

    public delete_branch(branch_name: string) {
        return this.runcmd("branch", ["-D", branch_name]).toString().trim()
    }

    public checkout(branch_name: string) {
        this.runcmd("checkout", [branch_name])
        this.show_branching_graph()
    }

    public checkout_dir_from_branch(dir: string, branch_name: string) {
        this.runcmd("checkout", [branch_name, "--", dir])
    }

    public set_branch_description(branch: string, description: string) {
        this.runcmd('config', [`branch.${branch}.description`, description])
    }
    public get_branch_description(branch: string): string[] {
        return this.to_lines(this.runcmd('config', [`branch.${branch}.description`]))
    }

    public merge(branch_name: string) {
        this.runcmd("merge", [branch_name])
        if (branch_name != "HEAD") this.show_branching_graph()
    }

    public rebase_branch_from_point_onto(branch: string, from_point: string, onto: string) {
        let result = this.runcmd("rebase", ["--onto", onto, from_point, branch])
        this.show_branching_graph()
        return result
    }

    public get commit_count(): number {
        try {
            return parseInt(this.runcmd("rev-list", ["--count", "HEAD"]).toString())
        } catch (e) {
            return 0
        }
    }

    public get_tags_matching(pattern: string): string[] {
        return this.to_lines(this.runcmd("tag", ["-l", pattern]))
    }

    public to_lines(buf: Buffer | string[] | string): string[] {
        let result: string[]
        if (buf instanceof Buffer) {
            result = buf.toString().split("\n")
        } else if (buf instanceof Array) {
            result = buf
        } else {
            result = buf.split("\n")
        }
        return _.filter(result, (s: string) => { return s.length > 0 })
    }

    public get_files_in_commit(commit: string): string[] {
        return this.to_lines(this.runcmd("diff-tree", ["--no-commit-id", "--name-only", "-r", commit]))
    }

    public create_tag(tagname: string) {
        this.runcmd("tag", [tagname])
    }

    public move_tag_to_head(tagname: string) {
        this.runcmd("tag", ["-d", tagname])
        this.runcmd("tag", [tagname])
    }

    public move_tag(tagname: string, ref: string) {
        this.runcmd("tag", ["-d", tagname])
        this.runcmd("tag", [tagname, ref])
    }

    public mv(from: string, to: string) {
        this.runcmd("mv", [from, to])
    }

    public add(path: string | string[]) {
        let paths: string[]
        if (path instanceof Array) {
            paths = path as string[]
        } else {
            paths = [path as string]
        }

        try {
            this.runcmd("add", paths)
        } catch (e) {
            throw new ErrorAddFailed(e.message)
        }
    }

    public ls_files_as_abspath(): AbsPath[] {
        let files = this.ls_files()
        let result: AbsPath[] = []
        for (let file of files) {
            result.push(this.project_dir.add(file))
        }
        return result
    }

    public ls_files(): string[] {
        let files = this.to_lines(this.runcmd("ls-files"))
        return files
    }

    public check_ignore(path: string): boolean {
        let lines: string[]
        let abspath = new AbsPath(path).realpath.abspath

        if (abspath == null) {
            throw new ErrorInvalidPath(path)
        }

        try {
            lines = this.to_lines(this.runcmd("check-ignore", [abspath], [1]))
        } catch (e) {
            throw new ErrorCheckIgnoreFailed(e.message)
        }

        return lines.indexOf(abspath) > -1
    }

    public commit(comment: string) {
        this.runcmd("commit", ["-m", comment])
    }
    public commit_allowing_empty(comment: string) {
        this.runcmd("commit", ["--allow-empty", "-m", comment])
    }

    public add_remote(name: string, url: string, track_branch?: string) {
        let options = ["add", name, url]
        if (track_branch) {
            options = options.concat(["-t", track_branch])
        }
        this.runcmd("remote", options)
    }

    public get_remotes(): Array<RemoteInfo> {
        let result: Array<RemoteInfo> = []
        let lines = this.to_lines(this.runcmd("remote", ["-v"]))

        for (let line of lines) {
            const s1 = line.split("\t")
            const name = s1[0]
            const s2 = s1[1].split(" ")
            const url = s2[0]
            if (s2[1] == "(fetch)") {
                result.push({ name: name, url: url })
            }
        }
        return result
    }

    public fetch(remote?: string) {
        let options: Array<string> = []
        if (remote) {
            options = options.concat([remote])
        }
        this.runcmd("fetch", options)
    }
}