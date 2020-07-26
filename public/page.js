'use strict';

function logMessage(msg) {
	console.warn('[NetflixSkipper] ' + msg);
}
function showToast(msg) {
	console.log('[NetflixSkipper] ' + msg);
}

async function boop() {
	const json = await PlexController.getMediaMetadata();
	console.log('jsons', json);
	return json;
}

let extensionId = '';
async function requestTheTVDB() {
	chrome.runtime.sendMessage(
        extensionId,
		{ contentScriptQuery: 'queryTVDB', name: 'Cowboy Bebop' },
		response => {
            console.log("queryTVDB response", response);
		}
	);
}

class PlexController {
	static makeRequest(url, user, server) {
		return new Promise(function(resolve, reject) {
			var origAccessToken = localStorage.myPlexAccessToken;
			var serverNode = {};
			if (localStorage.users) {
				serverNode = JSON.parse(localStorage.users);
			} else {
				logMessage('User details not found');
			}
			var tokenToTry = origAccessToken;
			if (serverNode === undefined) {
				serverNode = {
					users: [],
				};
			}

			if (user !== undefined && server !== undefined) {
				if (user < serverNode.users.length) {
					if (server < serverNode.users[user].servers.length) {
						tokenToTry =
							serverNode.users[user].servers[server].accessToken;
					} else {
						showToast('Could not find authentication info', 1);
						reject();
						return;
					}
				} else {
					showToast('Could not find authentication info', 1);
					reject();
					return;
				}
			}
			var onError = function() {
				if (user === undefined) {
					user = 0;
					server = 0;
				} else {
					server++;
					if (serverNode.users[user].servers.length === server) {
						user++;
						server = 0;
					}
				}
				PlexController.makeRequest(url, user, server).then(
					resolve,
					reject
				);
			};

			var authedUrl = url + '&X-Plex-Token=' + tokenToTry;
			logMessage('Calling ' + authedUrl);
			fetch(authedUrl, {
				onerror: onError,
			})
				.catch(state => {
					logMessage('catch case ' + JSON.stringify(state));
				})
				.then(state => {
					if (state.status === 200) {
						logMessage('Called sucessfully to ' + url);
						resolve(state);
					} else if (state.status === 401) {
						logMessage('Not Authorised ' + url);
						onError();
					} else if (state.status !== 200) {
						logMessage('Request returned ' + state.status);
						showToast(
							'Error calling: ' +
								url +
								'. Response: ' +
								state.responseText +
								' Code:' +
								state.status +
								' Message: ' +
								state.statusText,
							1
						);
					}
				});
		});
	}

	static async getMediaMetadata() {
		const url = window.location.href;
		let id = url.substr(url.indexOf('%2Fmetadata%2F') + 14);
		const idToken = id.indexOf('&');
		if (idToken !== -1) {
			id = id.substr(0, idToken);
		}

		const metaDataPath =
			window.location.origin +
			'/library/metadata/' +
			id;
			//'?includeConcerts=1&includeExtras=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeChapters=1&asyncCheckFiles=0&asyncRefreshAnalysis=0&asyncRefreshLocalMediaAgent=0';
		const response = await PlexController.makeRequest(metaDataPath);
		const xml = await new window.DOMParser().parseFromString(
			await response.text(),
			'text/xml'
		);
		const json = xml2json(xml);
		return json;
	}
}

(function () {
    // make sure the script is only run once on the page
    if (window.netflixSkipperLoaded) {
        return;
    }
    window.netflixSkipperLoaded = true;

    class NetflixController {
        constructor() {
            this.videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
            const enableTimer = setInterval(() => {
                this.sessionId = this.videoPlayer.getAllPlayerSessionIds()[0];
                this.player = this.videoPlayer.getVideoPlayerBySessionId(
                    this.sessionId
                );
                if (this.player) {
                    document.dispatchEvent(new CustomEvent('NS-initializedPlayer'));
                    clearInterval(enableTimer);
                }
            }, 50);
        }

        seek(time) {
            this.player.seek(time);
        }

        play() {
            this.player.play();
        }

        pause() {
            this.player.pause();
        }

        getCurrentTime() {
            return this.player.getCurrentTime();
        }

        getDuration() {
            return this.player.getDuration();
        }

        getMovieId() {
            return this.player.getMovieId();
        }

        isReady() {
            return this.player && this.player.isReady();
        }

        isLoading() {
            return this.player.isLoading();
        }

        isPaused() {
            return this.player.isPaused();
        }

        isPlaying() {
            return this.player.isPlaying();
        }
    }

    const player = ('netflix' in window)
        ? new NetflixController()
        : new PlexController();
    window.NSPlayer = player; // expose as debugging aid

    const checkInterval = 250;
    let enableSkipping = false;
    let thresholds = {};
    let videoId = null;
    let triggerScenes = {};
    let nextTriggerIndex = 0;
    let lastFrameTime = 0;

    function trySkip() {
        if (!enableSkipping || !player.isReady()) {
            return;
        }
        if (!player.isPlaying()) {
            return;
        }

        if (videoId !== player.getMovieId()) {
            resetVideoScenes();
            return;
        }

        var playTime = player.getCurrentTime();
        if (!lastFrameTime || lastFrameTime >= playTime) {
            // Sometimes state is "playing" when user pans back in time and triggers a load
            lastFrameTime = playTime;
            return;
        }

        while (nextTriggerIndex < triggerScenes.length) {
            const scene = triggerScenes[nextTriggerIndex];
            if (playTime >= scene.time) {
                if (playTime < scene.next && warningsAboveThreshold(scene)) {
                    console.info("NS: Seeking past scene", scene);
                    player.seek(scene.next);
                    player.play();
                    break;
                } else {
                    console.debug("Ignoring", scene);
                    nextTriggerIndex++;
                }
            } else {
                break;
            }
        }
    }

    function warningsAboveThreshold(scene) {
        if (scene.sex > thresholds.sexThreshold) return true;
        if (scene.blood > thresholds.bloodThreshold) return true;
        if (scene.violence > thresholds.violenceThreshold) return true;
        if (scene.suicide > thresholds.suicideThreshold) return true;
        if (scene.needle > thresholds.needleThreshold) return true;
        return false;
    }

    function mousedown(e) {
        if (e.which === 1) {
            console.debug("Current Playtime:", player.getCurrentTime());
        }
        if (enableSkipping) {
            // todo: I think this is only here so we reset on manual seek
            // might be better to auto reset if lastFrameTime has externally changed significantly
            resetVideoScenes();
        }
    }

    window.addEventListener('mousedown', mousedown);
    window.addEventListener('keydown', mousedown);

    function resetVideoScenes() {
        lastFrameTime = 0;
        nextTriggerIndex = 0;
        if (videoId !== player.getMovieId()) {
            videoId = player.getMovieId();
            triggerScenes = {};
            if (!videoId) return;
            const filename = "scenes/" + videoId + ".json";
            const cachedFile = localStorage.getItem('NS/' + filename);
            if (cachedFile) {
                const parsedFile = JSON.parse(cachedFile);
                triggerScenes = parsedFile.scenes;
                console.info("Loaded " + parsedFile.name + " (" + triggerScenes.length + " scenes) from cache.");
            } else {
                document.dispatchEvent(new CustomEvent('NS-requestVideoScenes', {
                    detail: {filename: filename}
                }));
            }
        }
    }

    document.addEventListener('NS-initializedPlayer', resetVideoScenes);

    document.addEventListener('NS-loadVideoScenes', function (e) {
        triggerScenes = e.detail.scenes;
        lastFrameTime = 0;
        nextTriggerIndex = 0;
        console.info("NS: Loaded " + e.detail.name + " (" + triggerScenes.length + " scenes)");
        localStorage.setItem('NS/' + e.detail.filename, JSON.stringify(e.detail));
    });

    document.addEventListener('NS-seek', function (e) {
        player.seek(e.detail);
    });

    let syncTimer;
    document.addEventListener('NS-loadSettings', function (e) {
        console.debug("NS: loaded settings", e.detail);
        thresholds = e.detail;
        extensionId = e.detail.extensionId;
        enableSkipping = e.detail.enableSkipping;
        clearInterval(syncTimer);
        if (enableSkipping) {
            syncTimer = setInterval(trySkip, checkInterval);
        }
    });
})();

/*	This work is licensed under Creative Commons GNU LGPL License.

	License: http://creativecommons.org/licenses/LGPL/2.1/
   Version: 0.9
	Author:  Stefan Goessner/2006
	Web:     http://goessner.net/
*/
function xml2json(xml, tab) {
    var X = {
        toObj: function(xml) {
            var o = {};
            if (xml.nodeType==1) {   // element node ..
                if (xml.attributes.length)   // element with attributes  ..
                    for (var i=0; i<xml.attributes.length; i++)
                        o["@"+xml.attributes[i].nodeName] = (xml.attributes[i].nodeValue||"").toString();
                if (xml.firstChild) { // element has child nodes ..
                    var textChild=0, cdataChild=0, hasElementChild=false;
                    for (var n=xml.firstChild; n; n=n.nextSibling) {
                        if (n.nodeType==1) hasElementChild = true;
                        else if (n.nodeType==3 && n.nodeValue.match(/[^ \f\n\r\t\v]/)) textChild++; // non-whitespace text
                        else if (n.nodeType==4) cdataChild++; // cdata section node
                    }
                    if (hasElementChild) {
                        if (textChild < 2 && cdataChild < 2) { // structured element with evtl. a single text or/and cdata node ..
                            X.removeWhite(xml);
                            for (var n=xml.firstChild; n; n=n.nextSibling) {
                                if (n.nodeType == 3)  // text node
                                    o["#text"] = X.escape(n.nodeValue);
                                else if (n.nodeType == 4)  // cdata node
                                    o["#cdata"] = X.escape(n.nodeValue);
                                else if (o[n.nodeName]) {  // multiple occurence of element ..
                                    if (o[n.nodeName] instanceof Array)
                                        o[n.nodeName][o[n.nodeName].length] = X.toObj(n);
                                    else
                                        o[n.nodeName] = [o[n.nodeName], X.toObj(n)];
                                }
                                else  // first occurence of element..
                                    o[n.nodeName] = X.toObj(n);
                            }
                        }
                        else { // mixed content
                            if (!xml.attributes.length)
                                o = X.escape(X.innerXml(xml));
                            else
                                o["#text"] = X.escape(X.innerXml(xml));
                        }
                    }
                    else if (textChild) { // pure text
                        if (!xml.attributes.length)
                            o = X.escape(X.innerXml(xml));
                        else
                            o["#text"] = X.escape(X.innerXml(xml));
                    }
                    else if (cdataChild) { // cdata
                        if (cdataChild > 1)
                            o = X.escape(X.innerXml(xml));
                        else
                            for (var n=xml.firstChild; n; n=n.nextSibling)
                                o["#cdata"] = X.escape(n.nodeValue);
                    }
                }
                if (!xml.attributes.length && !xml.firstChild) o = null;
            }
            else if (xml.nodeType==9) { // document.node
                o = X.toObj(xml.documentElement);
            }
            else
                alert("unhandled node type: " + xml.nodeType);
            return o;
        },
        toJson: function(o, name, ind) {
            var json = name ? ("\""+name+"\"") : "";
            if (o instanceof Array) {
                for (var i=0,n=o.length; i<n; i++)
                    o[i] = X.toJson(o[i], "", ind+"\t");
                json += (name?":[":"[") + (o.length > 1 ? ("\n"+ind+"\t"+o.join(",\n"+ind+"\t")+"\n"+ind) : o.join("")) + "]";
            }
            else if (o == null)
                json += (name&&":") + "null";
            else if (typeof(o) == "object") {
                var arr = [];
                for (var m in o)
                    arr[arr.length] = X.toJson(o[m], m, ind+"\t");
                json += (name?":{":"{") + (arr.length > 1 ? ("\n"+ind+"\t"+arr.join(",\n"+ind+"\t")+"\n"+ind) : arr.join("")) + "}";
            }
            else if (typeof(o) == "string")
                json += (name&&":") + "\"" + o.toString() + "\"";
            else
                json += (name&&":") + o.toString();
            return json;
        },
        innerXml: function(node) {
            var s = ""
            if ("innerHTML" in node)
                s = node.innerHTML;
            else {
                var asXml = function(n) {
                    var s = "";
                    if (n.nodeType == 1) {
                        s += "<" + n.nodeName;
                        for (var i=0; i<n.attributes.length;i++)
                            s += " " + n.attributes[i].nodeName + "=\"" + (n.attributes[i].nodeValue||"").toString() + "\"";
                        if (n.firstChild) {
                            s += ">";
                            for (var c=n.firstChild; c; c=c.nextSibling)
                                s += asXml(c);
                            s += "</"+n.nodeName+">";
                        }
                        else
                            s += "/>";
                    }
                    else if (n.nodeType == 3)
                        s += n.nodeValue;
                    else if (n.nodeType == 4)
                        s += "<![CDATA[" + n.nodeValue + "]]>";
                    return s;
                };
                for (var c=node.firstChild; c; c=c.nextSibling)
                    s += asXml(c);
            }
            return s;
        },
        escape: function(txt) {
            return txt.replace(/[\\]/g, "\\\\")
                .replace(/[\"]/g, '\\"')
                .replace(/[\n]/g, '\\n')
                .replace(/[\r]/g, '\\r');
        },
        removeWhite: function(e) {
            e.normalize();
            for (var n = e.firstChild; n; ) {
                if (n.nodeType == 3) {  // text node
                    if (!n.nodeValue.match(/[^ \f\n\r\t\v]/)) { // pure whitespace text node
                        var nxt = n.nextSibling;
                        e.removeChild(n);
                        n = nxt;
                    }
                    else
                        n = n.nextSibling;
                }
                else if (n.nodeType == 1) {  // element node
                    X.removeWhite(n);
                    n = n.nextSibling;
                }
                else                      // any other node
                    n = n.nextSibling;
            }
            return e;
        }
    };
    if (xml.nodeType == 9) // document node
        xml = xml.documentElement;
    return X.toObj(X.removeWhite(xml));
}
