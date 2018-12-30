import { execFileSync, ExecFileSyncOptions, execSync } from "child_process"
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


export type GitLogicConstructionArgs = {
    log_function?: (...args: any[]) => void
    error_function?: (...args: any[]) => void
    silent?: boolean
}

export class GitLogic {
    private log: (...args: any[]) => void
    private error: (...args: any[]) => void
    private silent = false

    public constructor(path?: AbsPath,
        log_function_or_args?: ((...args: any[]) => void) | GitLogicConstructionArgs
    ) {
        if (path != null) {
            this._path = path
        }

        let args: GitLogicConstructionArgs = {}

        if (typeof (log_function_or_args) == "function") {
            args.log_function = log_function_or_args
        } else if (log_function_or_args != undefined) {
            args = log_function_or_args
        }

        if (args.silent) {
            this.log = () => { }
            this.error = () => { }
            this.silent = true
        } else {
            this.log = args.log_function ? args.log_function : console.log
            this.error = args.error_function ? args.error_function : console.error
        }
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

    private _old_dir: string | null = null

    private _chdir_to_repo(): string {
        if (this._old_dir != null) {
            throw new Error("_chdir_to_repo called twice without _restore_dir")
        }
        if (!this._path.isDir) {
            throw new ErrorInvalidPath("GitLogic: project_dir is not an existing directory")
        }

        let dirinfo = ""
        try {
            if (process.cwd() != this._path.abspath) {
                this._old_dir = process.cwd()
                process.chdir(this._path.abspath)
                dirinfo = chalk.blue(`(in ${process.cwd()}) `)
            } else {
                dirinfo = chalk.black(`(in ${process.cwd()}) `)
            }
        } catch (e) { // process.cwd() throws an error if the current directory does not exist
            process.chdir(this._path.abspath)
        }
        return dirinfo
    }

    private _restore_dir() {
        if (this._old_dir) {
            process.chdir(this._old_dir)
        }
        this._old_dir = null
    }

    private _runcmd(gitcmd: string, args: string[] = [], allowed_statuses: number[] = [],
        kwargs: { stdio?: any, } = {}
    ): Buffer | string | string[] {

        try {
            const dirinfo = this._chdir_to_repo()
            this.log(dirinfo + chalk.blue("git " + [gitcmd].concat(args).join(" ")))

            let options: ExecFileSyncOptions = {}
            if (this.silent) {
                options.stdio = 'ignore'
            }
            if (kwargs.stdio) {
                options.stdio = kwargs.stdio
            }

            let result = execFileSync('git', [gitcmd].concat(args), options) // returns stdout of executed command
            if (result != null) {
                if (this.keep_color) {
                    this.log(result.toString())
                    this.keep_color = false
                } else {
                    this.log(chalk.cyan(result.toString()))
                }
            }
            return result
        } catch (e) {
            this.log("e.status:", e.status)
            if (allowed_statuses.indexOf(e.status) > -1) {
                this.log(chalk.black(`git command returned with allowed status ${e.status}`))
                return ""
            }
            this.error(chalk.cyan(`git command failed: ${e}`))
            throw e
        } finally {
            this._restore_dir()
        }
    }

    private _paths_to_files_in_repo?: { [key: string]: boolean } = undefined

    public analyze_repo_contents(include_unadded: boolean) {
        this._paths_to_files_in_repo = {}
        const files = this.get_all_files_in_repo(include_unadded)
        for (const file of files) {
            const abspath = this._path.add(file)
            this._paths_to_files_in_repo[abspath.abspath] = true
        }
    }

    public fast_is_file_in_repo(abspath: string): boolean {
        if (this._paths_to_files_in_repo == undefined) {
            throw Error("fast_is_file_in_repo() called before call to analyze_repo_contents()")
        }
        return this._paths_to_files_in_repo[abspath] == true
    }

    public get_all_files_in_repo(include_unadded: boolean = true): string[] {
        let opts = ['-cm']
        if (include_unadded) {
            opts = opts.concat(['-o', '--exclude-standard'])
        }
        const out = this._runcmd('ls-files', opts)
        return this.to_lines(out)
    }

    public get_all_ignored_files(): string[] {
        try {
            this._chdir_to_repo()

            const cmd = `find ${this._path.abspath} -mindepth 1  | git check-ignore --stdin`
            // console.log("cmd:", cmd, execSync(`find ${this._path.abspath}`).toString())
            const output = execSync(cmd)
            return this.to_lines(output)
        } finally {
            this._restore_dir()
        }
    }

    private _ignored_files_cache: { [key: string]: boolean } = {}
    public cache_ignored_files() {
        const ignored_files = this.get_all_ignored_files()
        this._ignored_files_cache = {}
        for (const file of ignored_files) {
            this._ignored_files_cache[file] = true
        }
    }

    public check_ignore(path: string | AbsPath): boolean {
        let lines: string[]
        let abspath = new AbsPath(path).realpath.abspath

        try {
            lines = this.to_lines(this.runcmd("check-ignore", [abspath], [1]))
        } catch (e) {
            throw new ErrorCheckIgnoreFailed(e.message + ` (path: ${abspath})`)
        }

        return lines.indexOf(abspath) > -1
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
            const str = buf.toString()
            result = str ? str.split("\n") : []
        } else if (buf instanceof Array) {
            result = buf
        } else {
            result = buf ? buf.split("\n") : []
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

    public commit(comment: string) {
        this.runcmd("commit", ["-m", comment])
    }
    public commit_allowing_empty(comment: string) {
        this.runcmd("commit", ["--allow-empty", "-m", comment])
    }

    public add_remote(name: string, url: string, args: { track_branch?: string } = {}) {
        let options = ["add", name, url]
        if (args.track_branch) {
            options = options.concat(["-t", args.track_branch])
        }
        this.runcmd("remote", options)
    }

    public remove_remote(name: string) {
        let options = ["remove", name]
        this.runcmd("remote", options)
    }

    public rename_remote(from_name: string, to_name: string) {
        let options = ["rename", from_name, to_name]
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

    public clone_from(remote_url: string | AbsPath, args: {
        as_remote?: string,
        head_branch?: string,
    } = {}) {
        if (remote_url instanceof AbsPath) {
            remote_url = "file://" + remote_url.abspath
        }

        if (!this.project_dir) {
            throw new ErrorInvalidPath("GitLogic: project_dir was not set")
        }

        const target_dir = this.project_dir
        this.project_dir = target_dir.parent.validate("is_dir")

        let git_args = [remote_url, target_dir.abspath]

        if (args.as_remote) {
            git_args = git_args.concat(['-o', args.as_remote])
        }
        if (args.head_branch) {
            git_args = git_args.concat(['-b', args.head_branch])
        }

        this.runcmd("clone", git_args)

        this.project_dir = target_dir
    }

    public git_cmd(cmd: string, args: string[], allowed_statuses: number[] = [], kwargs: { stdio?: any } = {}): string[] {
        return this.to_lines(this.runcmd(cmd, args, allowed_statuses, kwargs))
    }
}