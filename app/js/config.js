/* Runtime configuration.
 *
 * The repository keeps the plaintext API ID / Hash empty: release builds pack the project's
 * credentials into TG_API_PACKED (see js/apikey.js for the format and tools/release.sh in the
 * upstream project for the packer). To build a private package, either put your own credentials
 * in TG_API_ID / TG_API_HASH or enter them once in the app's API screen (stored on the TV).
 *
 * TG_API_PACKED below is the project's own pair in the packed form, so a build straight from
 * this repository works without asking for credentials.
 */
var REPORT_TO = "";
var TG_API_ID = 0;
var TG_API_HASH = "";
var TG_API_PACKED = "z1nvBeGmW6FYAFka6vnwZMncwoRRNH/rSSRKDt+9t1VirzP2EVM/julk73qbjdNDJQ==";
var UPDATE_MANIFEST = "";
var DIAG_TO = "";
var SELFTEST = "";
