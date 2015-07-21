exports.urlToFielName = function(url) {
	var urlParts = url.split("#");
	var pageName = urlParts[1] ? urlParts[1] : "index";
	var path = pageName + '.html';
	return path;
};