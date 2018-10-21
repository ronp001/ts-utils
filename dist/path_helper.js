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