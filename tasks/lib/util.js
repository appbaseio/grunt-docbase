exports.urlToFielName = function(url) {
	var urlParts = url.split("#");
	var pageName = urlParts[1] ? urlParts[1] : "index";
	var path = pageName + '.html';
	return path;
};
exports.getPageLinks = function(page, selector, callback) {
	page.evaluate(function(linksSelector) {
		var data = $(linksSelector);
		return data.toArray().map(function(a) {
			return $(a).attr('href');
		});
	}, callback, selector);
};