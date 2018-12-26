"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const _ = require("lodash");
var isBinaryFile = require("isbinaryfile");
/**
 * An immutable path object with utility methods to navigate the filesystem, get information and perform
 * operations on the path (read,write,etc.)
 */
class AbsPath {
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
    /**
     *
     * @param from a string or AbsPath specifying an absolute path, or null
     */
    constructor(from) {
        if (from == null || typeof from == "undefined") {
            this.abspath = null;
        }
        else if (from instanceof AbsPath) {
            this.abspath = from.abspath;
        }
        else {
            if (path.isAbsolute(from)) {
                this.abspath = path.normalize(from);
            }
            else {
                this.abspath = path.normalize(path.join(process.cwd(), from));
            }
        }
    }
    /**
     * @returns normalized absolute path.  returns "" if no path set
     */
    toString() {
        if (this.abspath == null)
            return "";
        return this.abspath;
    }
    /**
     * @return the basename of the path
     */
    get basename() {
        if (this.abspath == null)
            return "";
        return path.basename(this.abspath);
    }
    /**
     * @param other
     * @param must_be_contained_in_other
     *
     * @returns the relative path to get to this path from other
     */
    relativeFrom(other, must_be_contained_in_other = false) {
        if (this.abspath == null)
            return null;
        if (other.abspath == null)
            return null;
        if (must_be_contained_in_other) {
            if (!this.abspath.startsWith(other.abspath))
                return null;
        }
        let result = path.relative(other.abspath, this.abspath);
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
        return (this.abspath != null);
    }
    /**
     *
     * @param filepath path segment to add
     *
     * @returns filepath with the additional segment
     */
    add(filepath) {
        if (this.abspath == null)
            return this;
        return new AbsPath(path.join(this.abspath, filepath.toString()));
    }
    /**
     * @returns AbsPath of the parent dir. If path is root, returns AbsPath of root.
     */
    get parent() {
        if (this.abspath == null)
            return this;
        let parent_dir = path.dirname(this.abspath);
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
        if (this.abspath == null)
            return false;
        return (this.abspath == path.parse(this.abspath).root);
    }
    /**
     * @returns true if path is found in the filesystem, false otherwise
     */
    get exists() {
        if (this.abspath == null)
            return false;
        try {
            fs.lstatSync(this.abspath);
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
        if (this.abspath == null)
            return false;
        try {
            return fs.lstatSync(this.abspath).isFile();
        }
        catch (e) {
            return false;
        }
    }
    /**
     * @returns true if a directory, false otherwise
     */
    get isDir() {
        if (this.abspath == null)
            return false;
        try {
            return fs.lstatSync(this.abspath).isDirectory();
        }
        catch (e) {
            return false;
        }
    }
    /**
     * @returns true if a symbolic link, false otherwise
     */
    get isSymLink() {
        if (this.abspath == null)
            return false;
        try {
            return fs.lstatSync(this.abspath).isSymbolicLink();
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
        if (this.abspath == null)
            return false;
        if (!this.isFile)
            return false;
        return isBinaryFile.sync(this.abspath);
    }
    /**
     * throws an exception if path validation fails.
     * @param t what to check for
     * @returns itself
     */
    validate(t) {
        if (!this.exists) {
            if (t == "is_dir") {
                throw new Error(`${this.abspath}/ does not exist`);
            }
            else {
                throw new Error(`${this.abspath} does not exist`);
            }
        }
        switch (t) {
            case "exists":
                break;
            case "is_dir":
                if (!this.isDir)
                    throw new Error(`${this.abspath}/ is not a directory`);
                break;
            case "is_file":
                if (!this.isFile)
                    throw new Error(`${this.abspath} is not a file`);
                break;
            case "is_symlink":
                if (!this.isSymLink)
                    throw new Error(`${this.abspath} is not a symlink`);
                break;
            case "is_binary":
                if (!this.isBinaryFile)
                    throw new Error(`${this.abspath} is not a binary file`);
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
        if (this.abspath == null)
            return false;
        return this.add(filename).isFile;
    }
    /**
     * @returns true if contains a directory of the given name, false otherwise
     */
    containsDir(filename) {
        if (this.abspath == null)
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
        } while (allowed_depth-- > 0 && !current.isRoot && current.abspath != current.parent.abspath);
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
        if (this.abspath == null)
            return this;
        if (!this.isSymLink)
            return this;
        return new AbsPath(fs.readlinkSync(this.abspath).toString());
    }
    /**
     * @returns an AbsPath with symbolic links completely resolved
     */
    get realpath() {
        if (this.abspath == null)
            return this;
        return new AbsPath(fs.realpathSync(this.abspath));
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
        if (this.abspath == null || !this.isFile)
            return "";
        return fs.readFileSync(this.abspath, 'utf8');
    }
    /**
     * @returns file contents as a buffer object
     */
    get contentsBuffer() {
        if (this.abspath == null || !this.isFile)
            return Buffer.alloc(0);
        return fs.readFileSync(this.abspath);
    }
    /**
     * @returns parsed contents of a JSON file or null if not a JSON file
     */
    get contentsFromJSON() {
        if (this.abspath == null || !this.isFile)
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
     * store new contents in the file
     *
     * @param contents a string with the new contents
     */
    saveStrSync(contents) {
        if (this.abspath == null) {
            throw new Error("can't save - abspath is null");
        }
        try {
            this.parent.mkdirs();
        }
        catch (e) {
            throw new Error(`can't save ${this.toString()} - ${e.message}`);
        }
        fs.writeFileSync(this.abspath, contents);
    }
    //------------------------------------------------------------
    // Directory contents and traversal
    //------------------------------------------------------------
    /**
     * @returns an array of AbsPath objects corresponding to each entry in the directory
     * or null if not a directory
     */
    get dirContents() {
        if (this.abspath == null)
            return null;
        if (!this.isDir)
            return null;
        let result = [];
        for (let entry of fs.readdirSync(this.abspath)) {
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
        if (this.abspath == null)
            return;
        if (!this.exists)
            return;
        fs.renameSync(this.abspath, new_name);
    }
    unlinkFile() {
        this.rmFile();
    }
    rmFile() {
        if (this.abspath == null) {
            throw new Error(`rmFile - path is not set`);
        }
        if (!this.isFile) {
            throw new Error(`rmFile - {$this.filepath} is not a file`);
        }
        fs.unlinkSync(this.abspath);
    }
    //------------------------------------------------------------
    // Directory creation and removal
    //------------------------------------------------------------
    mkdirs() {
        if (this.abspath == null)
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
        if (this.abspath == null)
            return;
        if (!this.isDir)
            return;
        if (remove_self && !this.abspath.match(must_match)) {
            throw new Error(`${this.abspath} does not match ${must_match} - aborting delete operation`);
        }
        this.foreachEntryInDir((p, direction) => {
            if (p.abspath == null)
                return;
            if (!p.abspath.match(must_match)) {
                throw new Error(`${p.abspath} does not match ${must_match} - aborting delete operation`);
            }
            if (direction == "up" || direction == null) {
                if (p.isDir) {
                    fs.rmdirSync(p.abspath);
                }
                else {
                    fs.unlinkSync(p.abspath);
                }
            }
        });
        if (remove_self) {
            fs.rmdirSync(this.abspath);
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
    renameToNextVer() {
        let current_max_ver = this.maxVer;
        let newname;
        if (current_max_ver == null) {
            newname = this.abspath + ".1";
        }
        else {
            newname = this.abspath + `.${current_max_ver + 1}`;
        }
        this.renameTo(newname);
        return newname;
    }
    get existingVersions() {
        if (this.abspath == null)
            return null;
        if (!this.exists)
            return null;
        let regex = new RegExp(`${this.abspath}\.([0-9]+)`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aF9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcGF0aF9oZWxwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSw2QkFBNEI7QUFDNUIseUJBQXdCO0FBQ3hCLDRCQUEyQjtBQUMzQixJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUE7QUFFMUM7OztHQUdHO0FBQ0gsTUFBYSxPQUFPO0lBRWhCLDhEQUE4RDtJQUM5RCxrQkFBa0I7SUFDbEIsOERBQThEO0lBRTlEOzs7Ozs7T0FNRztJQUNJLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxVQUF5QixJQUFJLEVBQUUsVUFBeUIsSUFBSTtRQUNqRyxJQUFJLE9BQU8sSUFBSSxJQUFJLEVBQUU7WUFDakIsT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQTtTQUMxQjtRQUNELElBQUksT0FBTyxFQUFFO1lBQ1QsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUMxQixPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO2FBQzlCO2lCQUFNO2dCQUNILE9BQU8sSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQTthQUNsRDtTQUNKO2FBQU07WUFDSCxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1NBQzlCO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxNQUFNLENBQUMsWUFBWSxDQUFDLFFBQWdCO1FBQ3ZDLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsWUFBWSxDQUFBO0lBQzdDLENBQUM7SUFRRDs7O09BR0c7SUFDSCxZQUFZLElBQXlDO1FBQ2pELElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksSUFBSSxXQUFXLEVBQUU7WUFDNUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJ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