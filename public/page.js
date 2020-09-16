'use strict';

function logMessage(msg) {
	console.warn('[NetflixSkipper] ' + msg);
}
function showToast(msg) {
	console.log('[NetflixSkipper] ' + msg);
}

let extensionId = '';

function setIconStatus(active) {
	if (!extensionId) {
		return;
	}
	chrome.runtime.sendMessage(extensionId, {
		contentScriptQuery: 'setIconStatus',
		active: !!active,
	});
}

(function () {
    // make sure the script is only run once on the page
    if (window.netflixSkipperLoaded) {
        return;
    }
    window.netflixSkipperLoaded = true;

    class NetflixController {
        constructor() {
			const enableTimer = setInterval(() => {
				this.videoPlayer = this.videoPlayer
					|| netflix.appContext.state.playerApp.getAPI().videoPlayer;
				this.sessionId = this.videoPlayer.getAllPlayerSessionIds()[0];
				const player = this.videoPlayer.getVideoPlayerBySessionId(this.sessionId);
				if (player && player.getMovieId() && (!this.player || this.movieId !== player.getMovieId())) {
					this.player = player;
					this.movieId = player.getMovieId();
					console.debug('NS: Netflix Player detected', player.getMovieId());
					document.dispatchEvent(new CustomEvent('NS-initializedPlayer'));
				}
			}, 250);
		}

		undim() {
			const overlay = document.getElementsByClassName('evidence-overlay');
			if (overlay.length) {
				overlay[0].style.display = 'none';
			}
			const playerControls = document.getElementsByClassName('PlayerControlsNeo__layout');
			if (playerControls.length) {
				playerControls[0].classList.remove('PlayerControlsNeo__layout--dimmed');
			}
		}

		seek(time) {
			this.player.seek(time);
			this.undim();
		}

		play() {
			this.player.play();
			this.undim();
		}

		pause() {
			this.player.pause();
			this.undim();
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

		getTitle() {
			const element = document.querySelector('.video-title h4');
			if (element) {
				return element.innerHTML;
			}
			return '';
		}

		getSceneName() {
			const element = document.querySelector('.video-title span');
			if (element) {
				const seasonEpisode = element.innerHTML.replace(':', '');
				return this.getTitle() + '_' + seasonEpisode;
			}
			return '';
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

    const player = new NetflixController();
    window.NSPlayer = player; // expose as debugging aid

    const checkInterval = 200;
    let enableSkipping = false;
    let thresholds = {};
    let videoId = null;
    let sceneData = { scenes: [] };
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

        while (nextTriggerIndex < sceneData.scenes.length) {
            const scene = sceneData.scenes[nextTriggerIndex];
            if (playTime >= scene.time) {
                if (playTime < scene.next && warningsAboveThreshold(scene)) {
                    console.info("NS: Seeking past scene", scene);
                    player.seek(scene.next);
                    player.play();
                    break;
                } else {
                    // console.debug("Ignoring", scene);
                    nextTriggerIndex++;
                }
            } else {
                break;
            }
        }
    }

    function warningsAboveThreshold(scene) {
        for (const key in scene.thresholds) {
            if (key in thresholds && scene.thresholds[key] > thresholds[key]) {
                return true;
            }
        }
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
            sceneData = { scenes: [] };
            if (!videoId) return;
            const filename = `scenes/${videoId}.json`;
            const cachedFile = localStorage.getItem('NS/' + filename);
            if (cachedFile) {
                sceneData = JSON.parse(cachedFile);
                console.info("Loaded " + sceneData.name + " (" + sceneData.scenes.length + " scenes) from cache.");
                setIconStatus(sceneData.scenes.length > 0);
            } else {
                setIconStatus(false);
                document.dispatchEvent(new CustomEvent('NS-requestVideoScenes', {
                    detail: {filename: filename}
                }));
            }
        }
    }

    function parseUrlForHash() {
		const hash = window.location.hash;
		if (hash.length > 20) {
			const json = LZString.decompressFromEncodedURIComponent(
				hash.substr(2, hash.length - 3)
			);
			if (json && json.substr(0, 1) === '{') {
				try {
					const loadedData = JSON.parse(json);
					if (loadedData.scenes && loadedData.scenes.length) {
						window.location.hash = '';
						setSceneData(loadedData);
						console.log(
							`NS: Parsed ${loadedData.name} (${loadedData.scenes.length} scenes) from url.hash`
						);
					}
				} catch (e) {
					console.warn('NS: Failed to parse json from hash', e, json);
				}
			}
		}
	}
	parseUrlForHash();

    document.addEventListener('NS-initializedPlayer', resetVideoScenes);

    function sendCurrentTime() {
		chrome.runtime.sendMessage(extensionId, {
			currentTime: player.getCurrentTime(),
		});
	}
	function setSceneData(newData) {
		sceneData = newData;
		setIconStatus(newData.scenes && newData.scenes.length > 0)
		lastFrameTime = 0;
		nextTriggerIndex = 0;
		localStorage.setItem(`NS/scenes/${sceneData.id}.json`, JSON.stringify(sceneData));
	}

	document.addEventListener('NS-playerAction', function (e) {
		console.debug('NS playerAction received', e.detail);
		if (e.detail.playPauseToggle) {
			player.isPlaying() ? player.pause() : player.play();
			sendCurrentTime();
		} else if (e.detail.time) {
			player.seek(e.detail.time);
			nextTriggerIndex = 0;
		} else if (e.detail.delta) {
			player.seek(player.getCurrentTime() + e.detail.delta);
			nextTriggerIndex = 0;
			sendCurrentTime();
		}
		if (e.detail.getVideoId) {
			chrome.runtime.sendMessage(extensionId, {
				videoId: player.getMovieId(),
				sceneName: player.getSceneName(),
			});
		}
		if (e.detail.getCurrentTime) {
			sendCurrentTime()
		}

		if (e.detail.sceneData) {
			setSceneData(e.detail.sceneData)
			console.info(`NS: Loaded ${e.detail.sceneData.name} (${e.detail.sceneData.scenes.length} scenes)`);
		}

		if (e.detail.getSceneData) {
			chrome.runtime.sendMessage(extensionId, { sceneData });
		}

		if (e.detail.writeToUrlHash) {
			const json = JSON.stringify(e.detail.writeToUrlHash)
			console.log(`NS: Downloading sceneData ${json}`);
			window.location.hash = `#_${LZString.compressToEncodedURIComponent(json)}_`;
		}
	});

    let syncTimer;
    document.addEventListener('NS-loadSettings', function (e) {
        console.debug("NS: loaded settings", e.detail);
        thresholds = e.detail.thresholds;
        extensionId = e.detail.extensionId;
        enableSkipping = e.detail.enableSkipping;
        clearInterval(syncTimer);
        if (enableSkipping) {
            syncTimer = setInterval(trySkip, checkInterval);
        }
        setIconStatus(sceneData && sceneData.scenes && sceneData.scenes.length > 0);
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
