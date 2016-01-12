const Cu = Components.utils;
const {FileUtils} = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const {NetUtil} = Cu.import("resource://gre/modules/NetUtil.jsm", {});

var console= {
	log : function(str) {
		  Components.classes['@mozilla.org/consoleservice;1']
				    .getService(Components.interfaces.nsIConsoleService)
				    .logStringMessage(str);
		}
	};

function Mozgv() {
  this.preferences = null;
  this.settingsFile =null;
  this.prefBanch = null;
  }
	
	
Mozgv.prototype.parseInterval = function()
	{
	var s =  document.getElementById("interval").value;
	var interval = Interval.parse(s);
	if(interval == null) return null;
	if(interval.distance() > 100) {
	    return new Interval(interval.getContig(),interval.getStart(),interval.getStart()+100);
	    }
	return interval;
	}

Mozgv.prototype.moveView = function(side,percent)
	{
	var interval = this.parsePosition();
	if( interval == null) return;
	var viewLength= interval.distance();
	console.log("x1"+interval+"/"+interval.distance());
	var newStart;
	var shift=Math.round(viewLength*percent);
	if(shift < 1) shift=1;
	if(side < 0)
		{
		newStart= interval.getStart()-shift;
		if(newStart < 0) newStart=1;
		console.log("xx "+newStart+"/"+viewLength);
		}
	else
		{
		newStart= interval.getStart()+shift;
		}
	interval  = new Interval( interval.getContig(), newStart, newStart + (viewLength-1));
	document.getElementById("interval").value = interval.toString();
	this.repaintSVGBam();
	}

Mozgv.prototype.getSamtoolsPath = function()
	{
	var path = this.prefBanch.getCharPref("mozgv.samtools.path");
	if(path!=null) path=path.trim();
	if(path==null || path.length==0) return "samtools"; 
	return path;
	}


Mozgv.prototype.log = function(color,message)
	{
	var pane=document.getElementById("messages.panel");
	pane.setAttribute("style","color:"+color+";");
	pane.label=""+message;
	pane.setAttribute("tooltiptext",pane.label);
	}

Mozgv.prototype.logError = function(message)
	{
	this.log("red",message);
	}

Mozgv.prototype.logWarning = function(message)
	{
	this.log("orange",message);
	}

Mozgv.prototype.logInfo = function(message)
	{
	this.log("green",message);
	}

Mozgv.prototype.addMouseClick = function(gRead,samRecord)
	{
	gRead.addEventListener("click",function(){
		alert(samRecord.getReadName())
		});
	}

Mozgv.prototype.repaintSVGBam = function()
	{
	var that = this;
	var samtoolsExe = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces["nsILocalFile"]);
	try {
	samtoolsExe.initWithPath( this.getSamtoolsPath() );
	} catch(error) {
	this.logError("samtools executable "+ this.getSamtoolsPath()  +" doesn't exists");
        return;
	}
	if (!samtoolsExe.exists()) {
		this.logError("samtools executable "+ samtoolsExe.path +" doesn't exists");
        return;
		}
	
	/** get BAM path */
	var bamFilePath = document.getElementById('bampath').value;
	if(bamFilePath.trim().length==0) {
		this.logError("BAM is not defined");
        return;
		}
	var bamIFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces["nsILocalFile"]);
	bamIFile.initWithPath( bamFilePath );
	if (!bamIFile.exists()) {
		this.logError("file "+ bamIFile.path +" doesn't exists");
        return;
		}
		
	var interval = this.parseInterval();
	if( interval == null) {
		this.logError("Bad Interval.");
        return;
		}
	this.prefBanch.setCharPref("mozgv.lastRegionStr",interval.toString());
	
	
	/** create tmp directory */
	var tmpOutFile = FileUtils.getFile("TmpD", ["sam.tmp"]);	
	tmpOutFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
	
	var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(samtoolsExe);
    
    
    var observeHandler = {
        observe: function(nsIProcess, event, data) {
            switch (event) {
				case "process-finished":
					NetUtil.asyncFetch(tmpOutFile, function(inputStream, status) {
					  if (!Components.isSuccessCode(status)) {
						tmpOutFile.remove(false);
						return;
					  }

					  var samfileStr;
					  try { samfileStr = NetUtil.readInputStreamToString(inputStream, inputStream.available()); }
					  catch(error) {
					  	 that.logError(error);
					  	 tmpOutFile.remove(false);
					  	 return;
					  	 }
					  var reads=[];
					  var lines = samfileStr.split(/\n/);
						for(var i in lines) {
						 if(lines[i].length==0 || lines[i].charAt(0)=='@') continue;
						 var rec = SamRecord.parse(lines[i]);
						 reads.push(rec);
						}
						samfileStr=null;
						var viewer = new  SVGBrowser();
						viewer.createReadGroupCallBack = that.addMouseClick;
						var svgRoot= document.getElementById("drawingArea");
						while ( svgRoot.hasChildNodes()) svgRoot.removeChild(svgRoot.firstChild);
						viewer.build(
							svgRoot,
							interval,
							reads,
							null);
					  tmpOutFile.remove(false);
					  that.logInfo("Done"); 
					});
					
					break;
                case "process-failed":
                	that.logError("Process failed "+tmpOutFile.path); 
                	tmpOutFile.remove(false);
                	break;
            }
        }
    };
    
    var args=["view","-F","4",
    	"-o",tmpOutFile.path,
    	bamIFile.path,
    	interval
    	];
     process.runAsync(args, args.length,observeHandler,false);
	}



	
Mozgv.prototype.selectReferenceFile=function() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
nsIFilePicker);
	fp.appendFilter("Fasta Files (*.fa, *.fasta)","*.fa; *.fasta","*.fa.gz","*.fasta.gz");
	fp.appendFilter("All Files" ,"*.*");
	fp.init(window, "Select a Reference File.", nsIFilePicker.modeOpen);
	var res = fp.show();
	if (res != nsIFilePicker.returnCancel){
		document.getElementById('refpath').value = fp.file.path;
		
		/* save prefs */
		this.prefBanch.setCharPref("mozgv.reference.path",fp.file.path); 
		
		this.repaintSVGBam();
		}
	}

Mozgv.prototype.selectBamFile = function() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
nsIFilePicker);
	fp.appendFilter("BAM Files (*.bam, *.cram)","*.bam; *.cram");
	fp.appendFilter("All Files" ,"*.*");
	fp.init(window, "Select a BAM File.", nsIFilePicker.modeOpen);
	var res = fp.show();
	if (res != nsIFilePicker.returnCancel){
		document.getElementById('bampath').value = fp.file.path;
		this.repaintSVGBam();
		}
	}

Mozgv.prototype.doMenuOpen = function() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
nsIFilePicker);
	fp.appendFilter("BAM Files (*.bam, *.cram)","*.bam; *.cram");
	fp.appendFilter("All Files" ,"*.*");
	fp.init(window, "Select a BAM File.", nsIFilePicker.modeOpen);
	var res = fp.show();
	if (res != nsIFilePicker.returnCancel){
		var winargs={
			bam: fp.file.path
			};
		var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                            .getService(Components.interfaces.nsIWindowWatcher);
		watcher.openWindow(
			window,
			"chrome://mozgv/content/mozgv.xul",
			fp.file.leafName,
			"width=600,height=300",
			winargs
			);
		}
	}


Mozgv.prototype.onLoad = function() {
  
    this.settingsService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
	var settingsDirectory = directoryService.get("PrefD", Components.interfaces.nsIFile);
	this.settingsFile = Components.classes["@mozilla.org/file/local;1"].createInstance();
	this.settingsFile.QueryInterface(Components.interfaces.nsILocalFile);
	this.settingsFile.initWithPath(settingsDirectory.path);
	this.settingsFile.appendRelativePath("prefs-mozgv.js");
  
	
		/* Read the file */
	try {
	    this.settingsService.readUserPrefs(this.settingsFile);
	    
	} catch (exception) {
	    /* Do nothing, the file will be create in the future */
		console.log(exception);
	}
  	
  	this.prefBanch = this.settingsService.getBranch(null);
  	if( ! this.prefBanch.prefHasUserValue("mozgv.samtools.path") )
  		{
	  	this.prefBanch.setCharPref("mozgv.samtools.path","samtools");
  		}
	if( this.prefBanch.prefHasUserValue("mozgv.reference.path") )
  		{
	  	document.getElementById('refpath').value = this.prefBanch.getCharPref("mozgv.reference.path");
  		}
  	if( this.prefBanch.prefHasUserValue("mozgv.lastRegionStr") )
  		{
	  	document.getElementById('interval').value = this.prefBanch.getCharPref("mozgv.lastRegionStr");
  		}
	
 	if( "arguments" in window && window.arguments.length >0)
 		{
 		var args = window.arguments[0];
 		if( "bampath" in args )
 			{
 			document.getElementById('bampath').value = args.bam;
 			}
 		if( "refpath" in args )
 			{
 			document.getElementById('refpath').value = args.refpath;
 			}
 		if( "regionStr" in args )
 			{
 			document.getElementById('interval').value = args.regionStr;
 			}
 		this.repaintSVGBam();
 		}
	}


Mozgv.prototype.onUnLoad = function()
	{
	this.settingsService.savePrefFile(this.settingsFile);
	}

Mozgv.prototype.doMenuSaveSVG = function() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, "Select a File", nsIFilePicker.modeSave);
	fp.appendFilter("SVG Files (*.svg)","*.svg");
	fp.appendFilter("All Files" ,"*.*");
	var rv = fp.show();
	if ( rv == nsIFilePicker.returnCancel) return;
	var svgRoot= document.getElementById("drawingArea");
	var oFOStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
		createInstance(Components.interfaces.nsIFileOutputStream);
	var oFile = fp.file;
	oFOStream.init(oFile, 0x02 | 0x08 | 0x20, 0x664, 0); // write, create, truncate
	(new XMLSerializer()).serializeToStream(svgRoot, oFOStream, "UTF-8"); // rememeber, doc is the DOM tree
	oFOStream.close();
	}

var mozgv = new Mozgv();

