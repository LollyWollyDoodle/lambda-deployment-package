const fs = require("fs");

const async = require("async");

const getName = function (cb) {
	const packageJson = require("read-package-json");
	
	packageJson("package.json", function (er, data) {
		if (er) return cb(er);
		
		cb(null, data.name.replace(/@([a-zA-Z0-9_-]+)\//, "$1-"), data.version);
	});
};

const clean = function (cb) {
	const rm = require("rimraf");
	async.parallel([
		function (cb) { rm("package", cb); },
		function (cb) {
			getName(function (er, name) {
				if (er) return cb(er);
				rm(name + "-*", cb);
			});
		}
	], cb);
};

const pack = function (cb) {
	clean(function (err) {
		if (err) return cb(err);
		
		const child_process = require("child_process");
		const process = require("process");
		const zlib = require("zlib");
		const tar = require("tar");
		const archiver = require("archiver");
		
		child_process.exec("npm pack", function (error, stdout, stderr) {
			if (error) {
				cb(error);
				return;
			}
			
			const tgz = stdout.trim();
			
			fs.createReadStream(stdout.trim())
			.pipe(zlib.createGunzip())
			.pipe(tar.Extract({ path: "." }))
			.on("finish", function () {
				process.chdir("package");
				child_process.exec("npm install --production", function (error, stdout, stderr) {
					process.chdir("..");
					if (error) {
						cb(error);
						return;
					}
					
					var pkg = archiver("zip");
					var s = pkg.pipe(fs.createWriteStream(tgz.replace(".tgz", ".zip")));
					pkg.directory("package", false)
					.finalize();
					s.on("finish", cb);
				});
			});
		});
	});
};

const deploy = function (bucket, prefix, cb) {
	const AWS = require("aws-sdk");
	const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
	
	async.waterfall([
		getName,
		function (name, version, cb) {
			s3.putObject({
				Bucket: bucket,
				Key: prefix + version,
				ContentType: "application/zip",
				Body: fs.createReadStream(name + "-" + version + ".zip")
			}, cb);
		}
	], cb);
};

Object.defineProperties(module.exports, {
	pack: {
		value: pack,
		enumerable: true
	},
	clean: {
		value: clean,
		enumerable: true
	},
	deploy: {
		value: deploy,
		enumerable: true
	}
});
