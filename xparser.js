var xparser = {};

//feedType Enum
xparser.feedType = {
    rss     : 1,
    atom    : 2
};

xparser.getFeed = function (sUrl, fpCallBack, oCallBackScope) {
    var oReq = zXmlHttp.createRequest();
    oReq.onreadystatechange = function () {
        if (oReq.readyState == 4) {
            if (oReq.status == 200 || oReq.status == 304) {
                var oFeed = null;

                var oXmlDom = zXmlDom.createDocument();
                oXmlDom.loadXML(oReq.responseText);

                var oRootNode = oXmlDom.documentElement;

                //Get the name of the document element.
                var sRootName;	
                if (oRootNode.nodeName.indexOf(":") > -1)
                    sRootName = oRootNode.nodeName.split(":")[1];
                else
                    sRootName = oRootNode.nodeName;
                    
                switch (sRootName.toLowerCase()) {
                    case "feed": //It's Atom. Create the object.
                        oFeed = new xparser.AtomFeed(
                            oRootNode, 
                            fpCallBack, 
                            oCallBackScope
                        );
                        break;
                    case "rss": //It's RSS
                        //Check the version.
                        if (parseInt(oRootNode.getAttribute("version")) < 2)
                            throw new Error("XParser Error! RSS feed version " +
                                "is not supported"
                            );

                        oFeed = new xparser.RssFeed(
                            oRootNode, 
                            fpCallBack, 
                            oCallBackScope
                        );
                        break;
                    default: //The feed isn't supported.
                        throw new Error("XParser Error: The supplied feed " +
                            "is currently not supported."
                        );
                        break;
                }
            } else { //The HTTP Status code isn't what we wanted; throw an error.
                throw new Error("XParser Error: XMLHttpRequest failed. " +
                    "HTTP Status: " + oReq.status
                );
            }
        }
    };
	
    oReq.open("GET", sUrl, true);
    oReq.send(null);
};

xparser.FeedNode = function (oNode) {	
	this.value = (oNode && (oNode.text || oNode.getText())) || null;
};

xparser.BaseFeed = function (iFeedType, fpCallBack, oCallBackScope) {
    this.type           = iFeedType || null;
    this.title          = null;
    this.link           = null;
    this.description    = null;
    this.copyright      = null;
    this.generator      = null;
    this.modified       = null;
    this.author         = null;
    this.items          = [];
    
    this.callBack       = 
        (typeof fpCallBack == "function") ? fpCallBack : function () {};
    this.callBackScope  = 
        (typeof oCallBackScope == "object") ? oCallBackScope : this;
};  

xparser.BaseFeed.prototype = {
    parse       : function (oContextNode, oElements, oNamespaces  ) {
        //Loop through the keys
        for (var sProperty in oElements) {
            //Create FeedNode objects with the node
            //returned from the XPath evaluation
            this[sProperty] = new xparser.FeedNode(
                zXPath.selectSingleNode(
                    oContextNode, 
                    oElements[sProperty], 
                    oNamespaces
                )
            );
        }
    }
};

xparser.BaseItem = function () {
    this.title          = null;
    this.author         = null;
    this.link           = null;
    this.description    = null;
    this.date           = null;
};

xparser.BaseItem.prototype = {
    parse       : function (oContextNode, oElements, oNamespaces  ) {
        for (var prop in oElements) {
            this[prop] = new xparser.FeedNode(zXPath.selectSingleNode(oContextNode, oElements[prop], oNamespaces));
        }
    }
};

xparser.RssFeed = function (oRootNode, fpCallBack, oCallBackScope) {
    xparser.BaseFeed.apply(this, 
        [xparser.feedType.rss, fpCallBack, oCallBackScope]);
      
    var oChannelNode = zXPath.selectSingleNode(oRootNode, "channel");
    
    var oElements = {
        title          : "title",
        link           : "link",
        description    : "description",
        copyright      : "copyright",
        generator      : "generator",
        modified       : "lastbuilddate",
        author         : "managingeditor"
    };
    
    this.parse(oChannelNode, oElements, []);
    
    var cItems = zXPath.selectNodes(oChannelNode, "item");
    	
    for (var i = 0, oItem; oItem = cItems[i]; i++) {
        this.items.push(new xparser.RssItem(oItem));
    }
    			
    this.callBack.apply(this.callBackScope, [this]);
};

xparser.RssFeed.prototype = new xparser.BaseFeed();

xparser.RssItem = function (oItemNode) {
    xparser.BaseItem.apply(this, []);
    var oElements = {
        title       : "title",
        link        : "link",
        description : "description",
        date        : "pubdate",
        author      : "author"
    };

    this.parse(oItemNode, oElements, []);
};

xparser.RssItem.prototype = new xparser.BaseItem();

xparser.AtomFeed = function (oRootNode, fpCallBack, oCallBackScope) {
    xparser.BaseFeed.apply(this, 
        [xparser.feedType.atom, fpCallBack, oCallBackScope]
    );
    
    var oNamespaces = {
        atom : oRootNode.namespaceURI
    };
	
    var oElements = {
        title: "atom:title",
        link: "atom:link/@href",
        description: "atom:tagline",
        copyright: "atom:copyright",
        generator: "atom:generator",
        modified: "atom:modified",
        author: "atom:author"
    };
    
    this.parse(oRootNode, oElements, oNamespaces);
    
    var cEntries = zXPath.selectNodes(oRootNode, "atom:entry", oNamespaces);
	
    for (var i = 0, oEntry; oEntry = cEntries[i]; i++) {
        this.items.push(new xparser.AtomItem(oEntry, oNamespaces));
    }
    		
    this.callBack.apply(this.callBackScope, [this]);
};

xparser.AtomFeed.prototype = new xparser.BaseFeed();

xparser.AtomItem = function (oEntryNode, oNamespaces) {
    xparser.BaseItem.apply(this, []);
    
    var oElements = {
        title       : "atom:title",
        link        : "atom:link/@href",
        description : "atom:content",
        date        : "atom:issued",
        author      : "atom:author"
    };
    
    this.parse(oEntryNode, oElements, oNamespaces);
};

xparser.AtomItem.prototype = new xparser.BaseItem();