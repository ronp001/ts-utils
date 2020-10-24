"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const stripJsonComments = require("strip-json-comments");
var isBinaryFile = require("isbinaryfile");
function notnull(arg, name) {
    if (arg == null) {
        const exp = name ? ` for ${name}` : "";
        throw new Error(`unexpected value${exp}: ${arg}`);
    }
    return arg;
}
exports.notnull = notnull;
/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform
 * operations on the path (read,write,etc.)
 */
class AbsPath {
    /**
     *
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from) {
        if (from == null || typeof from == "undefined") {
            this._abspath = null;
        }
        else if (from instanceof AbsPath) {
            this._abspath = from._abspath;
        }
        else {
            if (path.isAbsolute(from)) {
                this._abspath = path.normalize(from);
            }
            else {
                this._abspath = path.normalize(path.join(process.cwd(), from));
            }
        }
    }
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
    static fromStringAllowingRelative(pathseg = null, basedir = null) {
        if (basedir == null) {
            basedir = process.cwd();
        }
        if (pathseg) {
            if (path.isAbsolute(pathseg)) {
                return new AbsPath(pathseg);
            }
            else {
                return new AbsPath(path.join(basedir, pathseg));
            }
        }
        else {
            return new AbsPath(basedir);
        }
    }
    /**
     * @param filepath starting point
     *
     * @returns array with an AbsPath object for each containing directory
     */
    static dirHierarchy(filepath) {
        return new AbsPath(filepath).dirHierarchy;
    }
    get abspath() {
        if (this._abspath == null) {
            throw new Error("abspath is not set");
        }
        return this._abspath;
    }
    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    toString() {
        if (this._abspath == null)
            return "";
        return this._abspath;
    }
    /**
     * @return the basename of the path
     */
    get basename() {
        if (this._abspath == null)
            return "";
        return path.basename(this._abspath);
    }
    /**
     * @param other
     * @param must_be_contained_in_other
     *
     * @returns the relative path to get to this path from other
     */
    relativeFrom(other, must_be_contained_in_other = false) {
        if (this._abspath == null)
            return null;
        if (other._abspath == null)
            return null;
        if (must_be_contained_in_other) {
            if (!this._abspath.startsWith(other._abspath))
                return null;
        }
        let result = path.relative(other._abspath, this._abspath);
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
    get isSet() {
        return (this._abspath != null);
    }
    /**
     *
     * @param filepath path segment to add
     *
     * @returns filepath with the additional segment
     */
    add(filepath) {
        if (this._abspath == null)
            return this;
        return new AbsPath(path.join(this._abspath, filepath.toString()));
    }
    /**
     * @returns AbsPath of the parent dir. If path is root, returns AbsPath of root.
     */
    get parent() {
        if (this._abspath == null)
            return this;
        let parent_dir = path.dirname(this._abspath);
        return new AbsPath(parent_dir);
    }
    /**
     * @param n how many levels up the hierarchy
     * @returns AbsPath of the directory which is <n> levels up.  (.parents(1) is the same is .parent)
     */
    parents(n) {
        let p = this;
        while (n > 0) {
            p = p.parent;
            n--;
        }
        return p;
    }
    //------------------------------------------------------------
    // Recognition
    //------------------------------------------------------------
    /**
     * @returns true if root directory of the filesystem, false otherwise
     */
    get isRoot() {
        if (this._abspath == null)
            return false;
        return (this._abspath == path.parse(this._abspath).root);
    }
    /**
     * @returns true if path is found in the filesystem, false otherwise
     */
    get exists() {
        if (this._abspath == null)
            return false;
        try {
            fs.lstatSync(this._abspath);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    /**
     * @returns true if a normal file, false otherwise
     */
    get isFile() {
        if (this._abspath == null)
            return false;
        try {
            return fs.lstatSync(this._abspath).isFile();
        }
        catch (e) {
            return false;
        }
    }
    /**
     * @returns true if a directory, false otherwise
     */
    get isDir() {
        if (this._abspath == null)
            return false;
        try {
            return fs.lstatSync(this._abspath).isDirectory();
        }
        catch (e) {
            return false;
        }
    }
    /**
     * @returns true if a directory, false otherwise
     */
    get isEmptyDir() {
        if (this._abspath == null)
            return false;
        if (!this.isDir)
            return false;
        try {
            const files = fs.readdirSync(this._abspath);
            return files.length == 0;
        }
        catch (e) {
            return false;
        }
    }
    /**
     * @returns true if a symbolic link, false otherwise
     */
    get isSymLink() {
        if (this._abspath == null)
            return false;
        try {
            return fs.lstatSync(this._abspath).isSymbolicLink();
        }
        catch (e) {
            return false;
        }
    }
    /**
     * see https://www.npmjs.com/package/isbinaryfile
     *
     * @returns true if the file is binary, false otherwise
     */
    get isBinaryFile() {
        if (this._abspath == null)
            return false;
        if (!this.isFile)
            return false;
        return isBinaryFile.sync(this._abspath);
    }
    /**
     * throws an exception if path validation fails.
     * @param t what to check for
     * @returns itself
     */
    validate(t) {
        if (!this.exists) {
            if (t == "is_dir") {
                throw new Error(`${this._abspath}/ does not exist`);
            }
            else {
                throw new Error(`${this._abspath} does not exist`);
            }
        }
        switch (t) {
            case "exists":
                break;
            case "is_dir":
                if (!this.isDir)
                    throw new Error(`${this._abspath}/ is not a directory`);
                break;
            case "is_file":
                if (!this.isFile)
                    throw new Error(`${this._abspath} is not a file`);
                break;
            case "is_symlink":
                if (!this.isSymLink)
                    throw new Error(`${this._abspath} is not a symlink`);
                break;
            case "is_binary":
                if (!this.isBinaryFile)
                    throw new Error(`${this._abspath} is not a binary file`);
                break;
            default:
                throw new Error(`unhandled validation: ${t}`);
        }
        return this;
    }
    //------------------------------------------------------------
    // Directory Contents
    //------------------------------------------------------------
    /**
     * @returns true if contains a file of the given name, false otherwise
     */
    containsFile(filename) {
        if (this._abspath == null)
            return false;
        return this.add(filename).isFile;
    }
    /**
     * @returns true if contains a directory of the given name, false otherwise
     */
    containsDir(filename) {
        if (this._abspath == null)
            return false;
        return this.add(filename).isDir;
    }
    /**
     * scans upwards from the current path, looking for a file or directory with a given name
     * @param filename the fs entry to search for
     * @param can_be_dir if false, will only look for regular files.  if true, will look for directories as well.
     * @returns true if found, false if not
     */
    findUpwards(filename, can_be_dir = false) {
        for (let dir of this.dirHierarchy) {
            if (dir.containsFile(filename)) {
                return dir.add(filename);
            }
            else if (can_be_dir && dir.containsDir(filename)) {
                return dir.add(filename);
            }
        }
        return new AbsPath(null);
    }
    /**
     * @returns an array of AbsPath objects, each one pointing to a containing directory
     */
    get dirHierarchy() {
        let current = this;
        let result = [];
        let allowed_depth = 30;
        do {
            result.push(current);
            current = current.parent;
        } while (allowed_depth-- > 0 && !current.isRoot && current._abspath != current.parent._abspath);
        result.push(current.parent);
        return result;
    }
    //------------------------------------------------------------
    // Symbolic Link Processing
    //------------------------------------------------------------
    /**
     * @returns an AbsPath pointing to the target of the symbolic link
     */
    get symLinkTarget() {
        if (this._abspath == null)
            return this;
        if (!this.isSymLink)
            return this;
        return new AbsPath(fs.readlinkSync(this._abspath).toString());
    }
    /**
     * @returns an AbsPath with symbolic links completely resolved
     */
    get realpath() {
        if (this._abspath == null)
            return this;
        return new AbsPath(fs.realpathSync(this._abspath));
    }
    //------------------------------------------------------------
    // File Contents
    //------------------------------------------------------------
    /**
     * @returns file contents as an array of strings
     */
    get contentsLines() {
        return this.contentsString.split('\n');
    }
    /**
     * @returns file contents as an array of strings
     */
    get contentsString() {
        if (this._abspath == null || !this.isFile)
            return "";
        return fs.readFileSync(this._abspath, 'utf8');
    }
    /**
     * @returns file contents as a buffer object
     */
    get contentsBuffer() {
        if (this._abspath == null || !this.isFile)
            return Buffer.alloc(0);
        return fs.readFileSync(this._abspath);
    }
    /**
     * @returns parsed contents of a JSON file or null if not a JSON file
     */
    get contentsFromJSON() {
        if (this._abspath == null || !this.isFile)
            return null;
        let buf = this.contentsBuffer;
        try {
            return JSON.parse(buf.toString());
        }
        catch (e) {
            return null;
        }
    }
    /**
     * @returns parsed contents of a JSONC file (ie, json with comments) or null if not a JSON/JSONC file
     */
    get contentsFromJSONC() {
        if (this._abspath == null || !this.isFile)
            return null;
        let buf = this.contentsBuffer;
        try {
            const json = stripJsonComments(buf.toString());
            return JSON.parse(json);
        }
        catch (e) {
            return null;
        }
    }
    /**
     * store new contents in the file
     *
     * @param contents a string with the new contents
     */
    saveStrSync(contents) {
        if (this._abspath == null) {
            throw new Error("can't save - abspath is null");
        }
        try {
            this.parent.mkdirs();
        }
        catch (e) {
            throw new Error(`can't save ${this.toString()} - ${e.message}`);
        }
        fs.writeFileSync(this._abspath, contents);
    }
    //------------------------------------------------------------
    // Directory contents and traversal
    //------------------------------------------------------------
    /**
     * @returns an array of AbsPath objects corresponding to each entry in the directory
     * or null if not a directory
     */
    get dirContents() {
        if (this._abspath == null)
            return null;
        if (!this.isDir)
            return null;
        let result = [];
        for (let entry of fs.readdirSync(this._abspath)) {
            result.push(this.add(entry));
        }
        return result;
    }
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
    foreachEntryInDir(fn) {
        let entries = this.dirContents;
        if (entries == null)
            return true;
        for (let entry of entries) {
            if (entry.isDir) {
                let abort;
                abort = fn(entry, "down");
                if (abort)
                    return true;
                abort = entry.foreachEntryInDir(fn);
                if (abort)
                    return true;
                abort = fn(entry, "up");
                if (abort)
                    return true;
            }
            else {
                let abort = fn(entry, null);
                if (abort)
                    return true;
            }
        }
        return false;
    }
    //------------------------------------------------------------
    // Modifying the filesystem
    //------------------------------------------------------------
    renameTo(new_name) {
        if (this._abspath == null)
            return;
        if (!this.exists)
            return;
        fs.renameSync(this._abspath, new_name);
    }
    unlinkFile() {
        this.rmFile();
    }
    rmFile() {
        if (this._abspath == null) {
            throw new Error(`rmFile - path is not set`);
        }
        if (!this.isFile) {
            throw new Error(`rmFile - ${this} is not a file`);
        }
        fs.unlinkSync(this._abspath);
    }
    //------------------------------------------------------------
    // Directory creation and removal
    //------------------------------------------------------------
    mkdirs() {
        if (this._abspath == null)
            throw new Error("can't mkdirs for null abspath");
        if (this.exists)
            return;
        if (this.isRoot)
            return;
        let parent = this.parent;
        if (parent.exists && !parent.isDir && !parent.isSymLink) {
            throw new Error(`${parent.toString()} exists and is not a directory or symlink`);
        }
        else {
            parent.mkdirs();
        }
        fs.mkdirSync(this.parent.realpath.add(this.basename).toString());
    }
    rmrfdir(must_match, remove_self = false) {
        if (this._abspath == null)
            return;
        if (!this.isDir)
            return;
        if (remove_self && !this._abspath.match(must_match)) {
            throw new Error(`${this._abspath} does not match ${must_match} - aborting delete operation`);
        }
        this.foreachEntryInDir((p, direction) => {
            if (p._abspath == null)
                return;
            if (!p._abspath.match(must_match)) {
                throw new Error(`${p._abspath} does not match ${must_match} - aborting delete operation`);
            }
            if (direction == "up" || direction == null) {
                if (p.isDir) {
                    fs.rmdirSync(p._abspath);
                }
                else {
                    fs.unlinkSync(p._abspath);
                }
            }
        });
        if (remove_self) {
            fs.rmdirSync(this._abspath);
        }
    }
    //------------------------------------------------------------
    // File version naming
    //
    // (assumes a numeric suffix describing the version
    //  e.g:  "myfile.txt.3" is version 3 of "myfile.txt")
    //
    // Useful for keeping a backup of a file before modifying it.
    //------------------------------------------------------------
    get maxVer() {
        let existing_versions = this.existingVersions;
        if (existing_versions == null)
            return null;
        let max = _.max(existing_versions);
        if (max == undefined)
            return null;
        return max;
    }
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
    renameToNextVer() {
        let current_max_ver = this.maxVer;
        let newname;
        if (current_max_ver == null) {
            newname = this._abspath + ".1";
        }
        else {
            newname = this._abspath + `.${current_max_ver + 1}`;
        }
        this.renameTo(newname);
        return new AbsPath(newname);
    }
    get existingVersions() {
        if (this._abspath == null)
            return null;
        if (!this.exists)
            return null;
        let regex = new RegExp(`${this._abspath}\.([0-9]+)`);
        let existing = this.parent.dirContents;
        let matching = _.map(existing, (el) => {
            let matches = el.toString().match(regex);
            if (matches == null)
                return null;
            return parseInt(matches[1]);
        });
        let nums = _.filter(matching, (e) => { return e != null; });
        return _.sortBy(nums);
    }
}
exports.AbsPath = AbsPath;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aF9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcGF0aF9oZWxwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw2QkFBNEI7QUFDNUIseUJBQXdCO0FBQ3hCLDRCQUEyQjtBQUMzQix5REFBeUQ7QUFDekQsSUFBSSxZQUFZLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFBO0FBRzFDLFNBQWdCLE9BQU8sQ0FBSSxHQUF5QixFQUFFLElBQWE7SUFDL0QsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFO1FBQ2IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUE7UUFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUE7S0FDcEQ7SUFDRCxPQUFPLEdBQUcsQ0FBQTtBQUNkLENBQUM7QUFORCwwQkFNQztBQUVEOzs7R0FHRztBQUNILE1BQWEsT0FBTztJQWtEaEI7OztPQUdHO0lBQ0gsWUFBWSxJQUF5QztRQUNqRCxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLElBQUksV0FBVyxFQUFFO1lBQzVDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFBO1NBQ3ZCO2FBQU0sSUFBSSxJQUFJLFlBQVksT0FBTyxFQUFFO1lBQ2hDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQTtTQUNoQzthQUFNO1lBQ0gsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUE7YUFDdkM7aUJBQU07Z0JBQ0gsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FB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