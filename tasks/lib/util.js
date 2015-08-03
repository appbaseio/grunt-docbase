exports.urlToFielName = function(url) {
	var urlParts = url.split("#");
	var pageName = urlParts[1] ? urlParts[1] : "index";
	var path = pageName + '.html';
	return path;
};
exports.versionLinks = function(mapFile) {
	var versions = Object.keys(mapFile).map(function(key) {
		var url = '#/' + key;
		return {
			link: url,
			realLink: url + '/' + mapFile[key][0].name +'/'+ mapFile[key][0].files[0].name
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