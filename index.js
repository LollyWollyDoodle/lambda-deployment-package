const clean = function (cb) {
	const rm = require("rimraf");
	const async = require("async");
	const packageJson = require("read-package-json")
	async.parallel([
		function (cb) { rm("package", cb); },
		function (cb) {
			packageJson("package.json", function (er, data) {
				if (er) {
					cb(er);
					return
				}
				rm(data.name.replace(/@([a-zA-Z0-9_-]+)\//, "$1-") + "-*", cb);
			});
		}
	], cb);
};

const pack = function (cb) {
	clean(function (err) {
		if (err) {
			cb(err);
			return;
		}
		
		const child_process = require("child_process");
		const process = require("process");
		const fs = require("fs");
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

Object.defineProperties(module.exports, {
	pack: {
		value: pack,
		enumerable: true
	},
	clean: {
		value: clean,
		enumerable: true
	}
});
