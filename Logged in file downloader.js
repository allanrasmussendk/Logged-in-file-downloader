// Logged in file downloader
// A file downloader that can download file(s) behind a log in / you need to be logged in before you can download the file(s).
// Version 1.1.1
// Started: 2024-10-08 (2024-03-30)


/*
Usage:
1. Make sure that the browser setting "Always ask you where to save files" under "Download" is unchecked
2. Log in to the site you want to download file(s) from
3. Open the console / press F12
4. Copy and paste this script into the console and press enter
5. Enter (or update) URL(s) to download in the dialog shown
6. Click on the "Download" button
7. Await download
8. Click on the "OK" button
9. Click on the "Close" button


Examples of alternate use

Example 1:
new LoggedInFileDownloader().start();

Example 2:
new LoggedInFileDownloader().startDownloading();

Example 3:
new LoggedInFileDownloader().startDownloading("index.html");

Example 4:
new LoggedInFileDownloader().startDownloading("/\n"
		+ "index.html\n"
		+ "ABT%20-%20Temp%20Download%20site/Index.html\n"
		+ "http://localhost:8080/ABT%20-%20Temp%20Download%20site/Index.html\n"
		+ "https://www.freecodecamp.org/news/here-is-the-most-popular-ways-to-make-an-http-request-in-javascript-954ce8c95aaa/");

Example 5:
new LoggedInFileDownloader().startDownloading(["/", "index.html", "ABT%20-%20Temp%20Download%20site/Index.html", "http://localhost:8080/ABT%20-%20Temp%20Download%20site/Index.html", "https://www.freecodecamp.org/news/here-is-the-most-popular-ways-to-make-an-http-request-in-javascript-954ce8c95aaa/"]);


*/

var jq371;

const autoStart = true;

if (!window.onerror) {
	window.onerror = function(message, source, lineno, colno, error) {
		alert("message: " + message + "\n"
		  + "source: " + source + "\n"
		  + "lineno: " + lineno + "\n"
		  + "colno: " + colno + "\n"
		  + "error: " + error);
		return false;
	}
}

const dialogId = "dialog_id";

const dialogContentId = "dialog_content_id";

const dialogButtonId = "dialog_button_id";
const dialogButtonMarginTop = "5px";

const urlCookieName = "URLs";
const urlCookieExpiresDays = 400;
const urlTextareaId = "url_textarea";

const statusLabelId = "status_label";

const jqueryMissingLimit = 50;
const jqueryMissingLimitNoConflict = 10; // Must be less that jqueryMissingLimit

const apiTypeAjax = "Ajax";
const apiTypeAjaxBlob = "Ajax blob";
const apiTypeDirectDownload = "Direct download";
const apiTypeXHR = "XHR";
const useApiType = apiTypeXHR; // apiTypeAjax, apiTypeAjaxBlob, apiTypeDirectDownload or apiTypeXHR

/*

Api / page		404	Html			Image			Cross domain					Notes
Ajax			404	Download		Incorrect download	Ok						Slow, sequential, cancellable, low bitrate, requires jquery
										(Requires: "access-control-allow-origin: *")
Ajax blob		404	Error			download		Ok						Slow, sequential, cancellable, low bitrate, requires jquery
				(Blob.size=undefined)				(Requires: "access-control-allow-origin: *")
Direct download	404	Download		Download		View (No download)				Fast, parallel, small code base
XHR			404	Download		Download		Ok						Fast, Might not in all browser, requires blob support
										(Requires: "access-control-allow-origin: *")
*/

class LoggedInFileDownloader {
	static jqueryLoaded = false;
	static jqueryLoadedNoConflict = false;

	static that;

	urls;
	ok;
	error;
	currentUrlIndex;
	missing;
	errorUrls;
	cancelled;
	
	constructor() {
		LoggedInFileDownloader.that = this;
		
		// To make setTimeout() work with this
		this.checkJqueryLoaded = this.checkJqueryLoaded.bind(this);
	}

	start() {
		var contentDiv = LoggedInFileDownloader.createDialog(750, 120, "Download", false, function() {
			LoggedInFileDownloader.that.startDownloading();
		});

		var header = document.createElement("h3");
		contentDiv.appendChild(header);
		header.innerHTML = "Logged in file downloader";
		header.style.textAlign = "center";
		header.style.margin = "0px";
		
		var label = document.createElement("label");
		contentDiv.appendChild(label);
		label.for = urlTextareaId;
		label.innerHTML = "URL(s) to download:";

		var br = document.createElement("br");
		contentDiv.appendChild(br);

		var urlTextarea = document.createElement("textarea");
		contentDiv.appendChild(urlTextarea);
		urlTextarea.id = urlTextareaId;
		urlTextarea.rows = 8;
		urlTextarea.cols = 100;
		var urlsString = LoggedInFileDownloader.getCookie(urlCookieName);
		if (urlsString) {
			urlTextarea.value = urlsString;
		} else {
			urlTextarea.placeholder = "Write URL(s) to download here";
		}
		urlTextarea.focus();
		
		// Remove the downloadButton to added it later to make it show first / most to the left? Bug? First float = "right" gets most right position.
		var downloadButton = document.getElementById(dialogButtonId);
		downloadButton.parentElement.removeChild(downloadButton);
		
		var dialogDiv = document.getElementById(dialogId);
		var closeButton = document.createElement("button");
		dialogDiv.appendChild(closeButton);
		closeButton.textContent = "Close";
		closeButton.style.fontSize = "20px";
		closeButton.style.marginTop = dialogButtonMarginTop;
		closeButton.style.marginLeft = "5px";
		closeButton.style.float = "right";
		closeButton.onclick = function() {
			LoggedInFileDownloader.that.saveUrls();
			LoggedInFileDownloader.closeDialog();
		};
		
		// Added it again here
		dialogDiv.appendChild(downloadButton);
	}
	
	reset() {
		this.ok = 0;
		this.error = 0;
		this.currentUrlIndex = 0;
		this.missing = 0;
		this.errorUrls = "";
		this.cancelled = false;
	}	

	startDownloading(urls) {
		if (!urls) {
			this.saveUrls();

			urls = LoggedInFileDownloader.getCookie(urlCookieName);
		}

		LoggedInFileDownloader.closeDialog();
		
		if (Array.isArray(urls)) {
			this.urls = urls;
		} else {
			this.urls = urls.split('\n');
		}
		
		for(var i = 0; i < this.urls.length; i++) {
			if (this.urls[i].length == 0) {
				this.urls.splice(i, 1);
				i--;			
			}
		}
			
		if (this.urls.length == 0) {
			alert("No URLs were entered");
			this.start();
			return;
		}

		switch (useApiType) {
			case apiTypeAjax :
			case apiTypeAjaxBlob : 
			case apiTypeXHR :
				this.reset();
				
				var contentDiv = LoggedInFileDownloader.createDialog(250, 30, "Cancel", true, function() {
					LoggedInFileDownloader.that.cancelled = true;
					alert("Cancelled");
				});
					
				var statusLabel = document.createElement("label");
				contentDiv.appendChild(statusLabel);
				statusLabel.id = statusLabelId;
				statusLabel.innerText = "Starting:";
				
				if (useApiType == apiTypeAjax || useApiType == apiTypeAjaxBlob) {
					this.checkJqueryLoaded();
				} else {
					this.nextUrl();
				}
			break;
			case apiTypeDirectDownload :
				for(var i = 0; i < this.urls.length; i++) {
					var url = this.urls[i];
					LoggedInFileDownloader.downloadUrl(url);
				}
				this.start();
			break;
			default :
				throw new Error("Unknown useApiType" + useApiType);
		}
	}

	saveUrls() {
		var urlTextarea = document.getElementById(urlTextareaId);
		if (urlTextarea) {
			var urls = urlTextarea.value;
			LoggedInFileDownloader.setCookie(urlCookieName, urls, urlCookieExpiresDays);
		}
	}

	setStatus(status) {
		var statusLabel = document.getElementById(statusLabelId);
		statusLabel.innerText = status;
	}

	checkJqueryLoaded() {
		if (this.cancelled) {
			LoggedInFileDownloader.closeDialog();
			this.start();
			return ;
		}

		try {
			if (LoggedInFileDownloader.jqueryLoadedNoConflict) {
				jq371;
				jq371.ajax;
				if (typeof jq371.ajax != "function") {
					throw new Error("typeof jq371.ajax != \"function\" " + typeof jq371.ajax + "    " + jq371);
				}
			} else {
				$;
				$.ajax;
				if (typeof $.ajax != "function") {
					throw new Error("typeof $.ajax != \"function\" " + typeof $.ajax);
				}
				jq371 = $;
			}
		} catch (e) {
			if (!LoggedInFileDownloader.jqueryLoaded) {
				LoggedInFileDownloader.loadJquery();
			} else if (!LoggedInFileDownloader.jqueryLoadedNoConflict && this.missing == jqueryMissingLimitNoConflict) {
				// https://stackoverflow.com/questions/528241/how-do-i-run-different-versions-of-jquery-on-the-same-page
				// On some site loading Jquery doesn't set $ for some odd reason.
				// This is fixed / hacked by using the jQuery.noConflict(true) call.
				console.log("jQuery.noConflict(true);");
				LoggedInFileDownloader.jqueryLoadedNoConflict = true;
				jq371 = jQuery.noConflict(true);
			}
			
			this.setStatus("Jquery missing (" + this.missing + " / " + jqueryMissingLimit + ")"); 
			console.log("jquery missing " + e);
			if (this.missing++ > jqueryMissingLimit) {
				console.error("jquery loading faild!!!");
				LoggedInFileDownloader.closeDialog();
				alert("jquery loading faild!!!");
				this.start();
				return ;
			}
			
			setTimeout(this.checkJqueryLoaded, 200);
			return ;
		}
			
		this.nextUrl();
	}

	nextUrl() {
		console.log("nextUrl");
		if (this.cancelled) {
			LoggedInFileDownloader.closeDialog();
			this.start();
			return ;
		}
		
		if (this.currentUrlIndex >= this.urls.length) {
			LoggedInFileDownloader.closeDialog();
			if (this.errorUrls.length > 0) {
				this.errorUrls = "\nError URL(s):\n" + this.errorUrls;
			}
			console.log("Ok: " + this.ok + ". Errors: " + this.error + "." + this.errorUrls);
			alert("Download complete.\nOk: " + this.ok + ".\nErrors: " + this.error + "." + this.errorUrls);
			this.start();
			return ;
		}
		
		var url = this.urls[this.currentUrlIndex];
		this.setStatus("Downloading " + (this.currentUrlIndex + 1) + " of " + this.urls.length);
		if (useApiType == apiTypeAjax) {
			// jq371
//			var JSDeferred = $.ajax(url, 
			var JSDeferred = jq371.ajax(url, 
				{
					dataType : "text",
					success : function() {
						LoggedInFileDownloader.that.handleAjaxSuccess(url, JSDeferred.responseText);
					},
					error : function(xhr, status, error) {
						LoggedInFileDownloader.that.handleAjaxError(xhr, status, error, url);
					}
				}
			);
		} else if (useApiType == apiTypeAjaxBlob) {
			// https://stackoverflow.com/questions/17657184/using-jquerys-ajax-method-to-retrieve-images-as-a-blob
//			var JSDeferred = $.ajax(url, 
			var JSDeferred = jq371.ajax(url, 
				{
					xhr: function() {
						var xhr = new XMLHttpRequest();
						xhr.onreadystatechange = function() {
							if (xhr.readyState == 2) {
								if (xhr.status == 200) {
									xhr.responseType = "blob";
								} else {
									xhr.responseType = "text";
								}
							}
						};
						return xhr;
					},
					success: function(data) {
						LoggedInFileDownloader.that.handleAjaxBlobSuccess(url, data);
					},
					error : function(xhr, status, error) {
						LoggedInFileDownloader.that.handleAjaxError(xhr, status, error, url);
					}
				}
			);
		} else {
			// Copied from https://stackoverflow.com/questions/8778863/downloading-an-image-using-xmlhttprequest-in-a-userscript
			// and modified
			var request = new XMLHttpRequest();
			var error = function(event) {
				var url = this.responseURL;
				if (url.length == 0) {
					url = LoggedInFileDownloader.that.urls[LoggedInFileDownloader.that.currentUrlIndex];
				}
				LoggedInFileDownloader.that.error++;
				LoggedInFileDownloader.that.currentUrlIndex++;

				if (LoggedInFileDownloader.that.errorUrls.length > 0) {
					LoggedInFileDownloader.that.errorUrls += "\n";
				}
				LoggedInFileDownloader.that.errorUrls += url;
				if (this.status > 0) {
					LoggedInFileDownloader.that.errorUrls += "  =>  " + this.status;
					if (this.statusText) {
						LoggedInFileDownloader.that.errorUrls += ": " + this.statusText;
					}
				} else {
					LoggedInFileDownloader.that.errorUrls += "  =>  " + event.type;
				}
				LoggedInFileDownloader.that.nextUrl();
			};
			request.addEventListener("load", function() {
				console.log("this.status: " + this.status);
				if (this.status === 200) {
					LoggedInFileDownloader.that.ok++;
					LoggedInFileDownloader.that.currentUrlIndex++;

					console.log("this.response.size: " + this.response.size);
					console.log("this.response.type: " + this.response.type);
					
					var url = this.responseURL;
					var fileName = LoggedInFileDownloader.calculateFileNameFromURL(url);
					console.log("fileName: " + fileName);
					
					LoggedInFileDownloader.downloadBlob(this.response, fileName);
					
					LoggedInFileDownloader.that.nextUrl();
				} else {
					error.call(this);
				}
			});
			request.addEventListener("error", error);
			request.responseType = "blob";
			request.open("GET", url);
			request.send();
		}
	}

	handleAjaxSuccess(url, responseText) {
		console.log("url: " + url);
		console.log("success: " + responseText.length + " bytes");
		
		this.ok++;
		this.currentUrlIndex++;
		
		var fileName = LoggedInFileDownloader.calculateFileNameFromURL(url);
		console.log("fileName: " + fileName);
		LoggedInFileDownloader.downloadData(responseText, fileName);
		
		this.nextUrl();
	}
	
	handleAjaxBlobSuccess(url, responseBlob) {
		console.log("url: " + url);
		if (!responseBlob.size) {
			this.handleAjaxError(null, null, "responseBlob.size is undefined", url);
			return ;
		}
			
		console.log("success: " + responseBlob.size + " bytes");
		
		this.ok++;
		this.currentUrlIndex++;
		
		var fileName = LoggedInFileDownloader.calculateFileNameFromURL(url);
		console.log("fileName: " + fileName);
		LoggedInFileDownloader.downloadBlob(responseBlob, fileName);
		
		this.nextUrl();
	}
	
	handleAjaxError(xhr, status, error, url) {
		var fullErrorText = url + "  =>  ";
		if (status) {
			fullErrorText += status;
		}
		if (error) {
			if (status) {
				fullErrorText += ": ";
			}
			fullErrorText += error;
		}

		console.error("Error for " + fullErrorText);
		
		this.error++;
		this.currentUrlIndex++;
		
		if (this.errorUrls.length > 0) {
			this.errorUrls += "\n";
		}
		this.errorUrls += fullErrorText;

		this.nextUrl();
	}
	
	static calculateFileNameFromURL(url) {
		var fileName;
		var lastIndexOf = url.lastIndexOf("/");
		if (lastIndexOf == -1) {
			fileName = url;
		} else {
			if (lastIndexOf == url.length - 1) {
				lastIndexOf = url.lastIndexOf("/", lastIndexOf - 1);
				if (lastIndexOf == -1) {
					fileName = "Index.html";
				} else {
					fileName = url.substring(lastIndexOf + 1, url.length - 1);
				}
			} else {
				fileName = url.substring(lastIndexOf + 1);
			}
		}
		fileName = fileName.replace(/[?&#()=/\\:]/g, "_");
		return fileName;
	}
	
	static loadJquery() {
		console.log("Loading jquery...");
		// Copied from https://stackoverflow.com/questions/43515860/how-to-insert-script-tag-in-head-of-dom-before-it-is-fully-loaded
		// and modified
		var jq = document.createElement('script');
		jq.src = "https://code.jquery.com/jquery-3.7.1.min.js";
		document.getElementsByTagName('head')[0].appendChild(jq);
		LoggedInFileDownloader.jqueryLoaded = true;
	}

	static createDialog(width, height, buttonName, buttonCenter, buttonAction) {
		var documentElement = document.documentElement;
		var pageXOffset = (window.pageXOffset || documentElement.scrollLeft) - (documentElement.clientLeft || 0);
		var pageYOffset = (window.pageYOffset || documentElement.scrollTop)  - (documentElement.clientTop || 0); 

		var dialogDiv = document.getElementById(dialogId);
		if (dialogDiv) {
			throw new Error("dialogId \"" + dialogId + "\" already exists " + dialogDiv);
		}
		
		var dialogDiv = document.createElement("div");
		document.body.appendChild(dialogDiv);
		dialogDiv.id = dialogId;
		dialogDiv.style.position = "absolute";
		var clientWidth = document.getElementsByTagName("body")[0].clientWidth;
		dialogDiv.style.left = (clientWidth / 2 + pageXOffset - width / 2) + "px";
		dialogDiv.style.top = (100 + pageYOffset - height / 2) + "px"; // "screen.height / 2" doesn't work
		dialogDiv.style.width = width + "px";
		dialogDiv.style.zIndex = 1000;
		dialogDiv.style.background = "lightgray";
		dialogDiv.style.border = "thick solid #000000";
		dialogDiv.style.borderRadius = "15px";
		dialogDiv.style.padding = "10px";

		var contentDiv = document.createElement("div");
		dialogDiv.appendChild(contentDiv);
		contentDiv.id = dialogContentId;
		
		var dialogButton = document.createElement("button");
		dialogDiv.appendChild(dialogButton);
		dialogButton.id = dialogButtonId;
		dialogButton.innerText = buttonName;
		dialogButton.style.fontSize = "20px";
		dialogButton.style.marginTop = dialogButtonMarginTop;
		if (buttonCenter) {
			dialogButton.style.marginLeft = "auto";
			dialogButton.style.marginRight = "auto";
			dialogButton.style.display = "block";
		} else {
			dialogButton.style.float = "right";
		}
		dialogButton.onclick = buttonAction;
		
		return contentDiv;
	}

	static closeDialog() {
		var dialogDiv = document.getElementById(dialogId);
		if (dialogDiv) {
			dialogDiv.parentElement.removeChild(dialogDiv);
		}
	}

	// Copied from https://stackoverflow.com/questions/2250421/how-do-i-encode-decode-short-strings-as-base64-using-gwt
	// and from https://stackoverflow.com/questions/9786508/javascript-atob-returning-string-contains-an-invalid-character
	// and modified
	static base64Encode(string) {
		var encode = encodeURIComponent(string).replace(/%([a-f0-9]{2})/gi, (m, $1) => String.fromCharCode(parseInt($1, 16)));
		return btoa(encode)
	}

	// Copied from https://stackoverflow.com/questions/3916191/download-data-url-file
	// and modified
	static downloadData(fileData, suggestedFileName) {
		var base64Encoded = LoggedInFileDownloader.base64Encode(fileData);
		var url = "data:text/html;base64," + base64Encoded;
		LoggedInFileDownloader.downloadUrl(url, suggestedFileName);
	}

	static downloadBlob(blob, suggestedFileName) {
		var objectURL = window.URL.createObjectURL(blob);
		LoggedInFileDownloader.downloadUrl(objectURL, suggestedFileName);
	}
	
	static downloadUrl(url, suggestedFileName) {
		var link = document.createElement("a");
		document.body.appendChild(link);
		if (suggestedFileName) {
			link.download = suggestedFileName;
		} else {
			link.download = "";
		}
		link.href = url;
		if (useApiType == apiTypeDirectDownload) {
			link.target = "_blank";
		}
		link.click();
		
		document.body.removeChild(link);
	}
	
	// Copied from https://www.w3schools.com/js/js_cookies.asp
	// and modified
	static setCookie(cookieName, cookieValue, cookieExpiresDays) {
		const date = new Date();
		date.setTime(date.getTime() + (cookieExpiresDays * 24 * 60 * 60 *1000));
		var expiresString = "expires=" + date.toUTCString();
		document.cookie = cookieName + "=" + encodeURIComponent(cookieValue) + "; " + expiresString + "; path=/; SameSite=Lax";
	}

	// Copied from https://www.w3schools.com/js/js_cookies.asp
	// and modified
	static getCookie(cookieName) {
		var searchName = cookieName + "=";
		var decodedCookies = decodeURIComponent(document.cookie);
		var cookieArray = decodedCookies.split(';');
		for(var i = 0; i < cookieArray.length; i++) {
			var cookieData = cookieArray[i];
			while (cookieData.charAt(0) == ' ') {
				cookieData = cookieData.substring(1);
			}
			if (cookieData.indexOf(searchName) == 0) {
				return cookieData.substring(searchName.length, cookieData.length);
			}
		}
		return null;
	}
}

if (autoStart) {
	new LoggedInFileDownloader().start();
}

console.log("Logged in file downloader has been loaded");
