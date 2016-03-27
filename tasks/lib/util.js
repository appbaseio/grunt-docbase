exports.urlToFielName = function(url) {
	var urlParts = url.split("#");
	var pageName = urlParts[1] ? urlParts[1] : "index";
	if (pageName[pageName.length - 1] === '/') {
		pageName = pageName.substr(0, pageName.length - 1);
	}
	pageName = pageName == 'index' ? pageName : '.' + pageName;
	var path = pageName + '.html';
	return path;
};
exports.versionLinks = function(mapFile) {
	var versions = Object.keys(mapFile).map(function(key) {
		var url = '#/' + key;
		return {
			link: url,
			realLink: url
		}
	});
	return versions;
};
exports.inQuotes = function(s) {
	return '"' + s + '"';
};
exports.getPageLinks = function(page, selector, callback) {
	page.evaluate(function(linksSelector) {
		var data = $(linksSelector);
		return data.toArray().map(function(a) {
			return $(a).attr('href');
		}).filter(function(link) {
			return link.indexOf("http://") === -1 && link.indexOf("https://") === -1;
		});
	}, function(a) {
		callback(a);
	}, selector);
};
exports.getGitMap = function(page, selector, callback) {
	page.evaluate(function(linksSelector) {
		var data = $('.onlyMap');
		return data.toArray().map(function(b) {
			return $(b).html().trim();
		});
	}, function(a) {
		var returnedVal = a[0];
		var obj = returnedVal == "" ? returnedVal : JSON.parse(returnedVal);
		callback(obj);
	}, selector);
};
exports.waitFor = function($config, page) {
	$config._start = $config._start || new Date().getTime();

	if ($config.timeout && new Date().getTime() - $config._start > $config.timeout) {
		if ($config.error) $config.error();
		if ($config.debug) console.log('timedout ' + (new Date - $config._start) + 'ms');
		return;
	}
	page.evaluate($config.check, function(result) {
		if (result) {
			if (result) {
				if ($config.debug) console.log('success ' + (new Date - $config._start) + 'ms');
				$config.success();
			}
		} else {
			setTimeout(function() {
				if ($config.debug) console.log('Retrying');
				exports.waitFor($config, page);
			}, $config.interval || 0);
		}

	}, $config.checkLoadedSelector && $config.checkNavbar);
}