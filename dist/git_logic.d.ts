/// <reference types="node" />
import { AbsPath } from "./path_helper";
export declare class ErrorNotConnectedToProject extends Error {
}
export declare class ErrorInvalidPath extends Error {
}
export declare class ErrorAddFailed extends Error {
}
export declare class ErrorCheckIgnoreFailed extends Error {
}
export declare enum GitState {
    Undefined = "Undefined",
    NonRepo = "Non Repo",
    NoCommits = "No Commits",
    Dirty = "Dirty",
    Clean = "Clean",
    OpInProgress = "OpInProgress"
}
export interface RemoteInfo {
    name: string;
    url: string;
}
export declare class GitLogic {
    private log;
    constructor(path?: AbsPath, log_function?: (...args: any[]) => void);
    auto_connect(): void;
    private _path;
    project_dir: AbsPath;
    runcmd: (gitcmd: string, args?: string[], allowed_statuses?: number[]) => string | string[] | Buffer;
    private keep_color;
    private _runcmd;
    readonly state: GitState;
    readonly has_head: boolean;
    readonly is_repo: boolean;
    status(): void;
    readonly parsed_status: string[];
    readonly stash_list: string[];
    readonly stash_count: number;
    stash_with_untracked_excluding(dir_to_exclude: string): boolean;
    stash_pop(): void;
    init(): void;
    readonly current_branch_or_null: string | null;
    readonly current_branch: string;
    show_branching_graph(): void;
    create_branch(branch_name: string, branching_point: string): string;
    delete_branch(branch_name: string): string;
    checkout(branch_name: string): void;
    checkout_dir_from_branch(dir: string, branch_name: string): void;
    set_branch_description(branch: string, description: string): void;
    get_branch_description(branch: string): string[];
    merge(branch_name: string): void;
    rebase_branch_from_point_onto(branch: string, from_point: string, onto: string): string | string[] | Buffer;
    readonly commit_count: number;
    get_tags_matching(pattern: string): string[];
    to_lines(buf: Buffer | string[] | string): string[];
    get_files_in_commit(commit: string): string[];
    create_tag(tagname: string): void;
    move_tag_to_head(tagname: string): void;
    move_tag(tagname: string, ref: string): void;
    mv(from: string, to: string): void;
    add(path: string | string[]): void;
    ls_files_as_abspath(): AbsPath[];
    ls_files(): string[];
    check_ignore(path: string): boolean;
    commit(comment: string): void;
    commit_allowing_empty(comment: string): void;
    add_remote(name: string, url: string, track_branch?: string): void;
    get_remotes(): Array<RemoteInfo>;
    fetch(remote?: string): void;
}
