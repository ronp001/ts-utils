/// <reference types="node" />
export declare function notnull<T>(arg: T | null | undefined, name?: string): T;
/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform
 * operations on the path (read,write,etc.)
 */
export declare class AbsPath {
    /**
     * create an absolute path from a string
     *
     * @param pathseg - if an absolute path, ignores basedir
     *                  if relative path, uses basedir as reference point
     * @param basedir - if null: uses process.cwd() as basedir
     */
    static fromStringAllowingRelative(pathseg?: string | null, basedir?: string | null): AbsPath;
    /**
     * @param filepath starting point
     *
     * @returns array with an AbsPath object for each containing directory
     */
    static dirHierarchy(filepath: string): Array<AbsPath>;
    readonly _abspath: string | null;
    get abspath(): string;
    /**
     *
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from: string | null | undefined | AbsPath);
    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    toString(): string;
    /**
     * @return the basename of the path
     */
    get basename(): string;
    /**
     * @param other
     * @param must_be_contained_in_other
     *
     * @returns the relative path to get to this path from other
     */
    relativeFrom(other: AbsPath, must_be_contained_in_other?: boolean): string | null;
    /**
     *
     * @param other
     * @param must_be_contained_in_other
     *
     * @returns the relative path to get to the other path from this path
     */
    /**
     * @returns true if path is set, false if it is null
     */
    get isSet(): boolean;
    /**
     *
     * @param filepath path segment to add
     *
     * @returns filepath with the additional segment
     */
    add(filepath: string): AbsPath;
    /**
     * @returns AbsPath of the parent dir. If path is root, returns AbsPath of root.
     */
    get parent(): AbsPath;
    /**
     * @param n how many levels up the hierarchy
     * @returns AbsPath of the directory which is <n> levels up.  (.parents(1) is the same is .parent)
     */
    parents(n: number): AbsPath;
    /**
     * @returns true if root directory of the filesystem, false otherwise
     */
    get isRoot(): boolean;
    /**
     * @returns true if path is found in the filesystem, false otherwise
     */
    get exists(): boolean;
    /**
     * @returns true if a normal file, false otherwise
     */
    get isFile(): boolean;
    /**
     * @returns true if a directory, false otherwise
     */
    get isDir(): boolean;
    /**
     * @returns true if a directory, false otherwise
     */
    get isEmptyDir(): boolean;
    /**
     * @returns true if a symbolic link, false otherwise
     */
    get isSymLink(): boolean;
    /**
     * see https://www.npmjs.com/package/isbinaryfile
     *
     * @returns true if the file is binary, false otherwise
     */
    get isBinaryFile(): boolean;
    /**
     * throws an exception if path validation fails.
     * @param t what to check for
     * @returns itself
     */
    validate(t: "exists" | "is_dir" | "is_file" | "is_symlink" | "is_binary"): AbsPath;
    /**
     * @returns true if contains a file of the given name, false otherwise
     */
    containsFile(filename: string): boolean;
    /**
     * @returns true if contains a directory of the given name, false otherwise
     */
    containsDir(filename: string): boolean;
    /**
     * scans upwards from the current path, looking for a file or directory with a given name
     * @param filename the fs entry to search for
     * @param can_be_dir if false, will only look for regular files.  if true, will look for directories as well.
     * @returns true if found, false if not
     */
    findUpwards(filename: string, can_be_dir?: boolean): AbsPath;
    /**
     * @returns an array of AbsPath objects, each one pointing to a containing directory
     */
    get dirHierarchy(): Array<AbsPath>;
    /**
     * @returns an AbsPath pointing to the target of the symbolic link
     */
    get symLinkTarget(): AbsPath;
    /**
     * @returns an AbsPath with symbolic links completely resolved
     */
    get realpath(): AbsPath;
    /**
     * @returns file contents as an array of strings
     */
    get contentsLines(): Array<string>;
    /**
     * @returns file contents as an array of strings
     */
    get contentsString(): string;
    /**
     * @returns file contents as a buffer object
     */
    get contentsBuffer(): Buffer;
    /**
     * @returns parsed contents of a JSON file or null if not a JSON file
     */
    get contentsFromJSON(): Object | null;
    /**
     * @returns parsed contents of a JSONC file (ie, json with comments) or null if not a JSON/JSONC file
     */
    get contentsFromJSONC(): Object | null;
    /**
     * store new contents in the file
     *
     * @param contents a string with the new contents
     */
    saveStrSync(contents: string): void;
    /**
     * @returns an array of AbsPath objects corresponding to each entry in the directory
     * or null if not a directory
     */
    get dirContents(): Array<AbsPath> | null;
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
    foreachEntryInDir(fn: (entry: AbsPath, traversal_direction: "down" | "up" | null) => boolean | void): boolean;
    renameTo(new_name: string): void;
    unlinkFile(): void;
    rmFile(): void;
    mkdirs(): void;
    rmrfdir(must_match: RegExp, remove_self?: boolean): void;
    get maxVer(): number | null;
    /**
     * renames <path> to <path>.<n+1>, where <n> is the largest integer for which <path>.<n> exists
     * if no file matching the form <path>.<n> is found, renames to <path>.1
     *
     * for example, if the current path is "/my/file", it will be renamed to:
     *   /my/file.2   - if /my/file.1 exists
     *   /my/file.3   - if /my/file.2 exists
     *   /my/file.1   - if no such file exists
     *   etc.
     */
    renameToNextVer(): AbsPath;
    get existingVersions(): number[] | null;
}
