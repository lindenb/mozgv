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
  }
	
	
Mozgv.prototype.parsePosition = function()
	{
	var s =  document.getElementById("interval").value;
	var interval = Interval.parse(s);
	if(interval == null) return null;
	if(interval.distance()>100) {
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
	return "/home/lindenb/src/samtools/samtools";
	}

Mozgv.prototype.paintError = function(err)
	{
	var svg= document.getElementById("drawingArea");
	while ( svg.hasChildNodes()) svg.removeChild(svg.firstChild);
	var message = SVG.createText(0,12,""+err);
	svg.setAttribute("width","100");
	svg.setAttribute("height","100");
	svg.appendChild(message);
	message.setAttribute("style","stroke:red;fill:none;font-size:12;");
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
	var bamExeFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces["nsILocalFile"]);
	bamExeFile.initWithPath( this.getSamtoolsPath() );
	if (!bamExeFile.exists()) {
		alert("file "+file+" doesn't exists");
        return;
		}
	
	var tmpOutFile = FileUtils.getFile("TmpD", ["sam.tmp"]);	
	tmpOutFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
	
	var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
    process.init(bamExeFile);
    
    
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
					  catch(error) { console.log(error); return;}
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
							new Interval("rotavirus",237,247),
							reads,
							null);
					  tmpOutFile.remove(false);
					});
					
					break;
                case "process-failed":
                	this.paintError("Process failed "+tmpOutFile.path); 
                	tmpOutFile.remove(false);
                	break;
            }
        }
    };
    
    var args=["view","-F","4","-o",tmpOutFile.path,"/home/lindenb/src/gatk-ui/testdata/S1.bam","rotavirus:37-47"];
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
		var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefService).getDefaultBranch(null);
        prefs.setCharPref("mozgv.reference.path",fp.file.path); 
		
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
  
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefService).getDefaultBranch(null);

    if( prefs.prefHasUserValue("mozgv.reference.path") )
    	{
		var value = prefs.getCharPref("mozgv.reference.path"); 
		document.getElementById('refpath').value = ""+value;
		}
		
 	if( "arguments" in window && window.arguments.length >0)
 		{
 		var args = window.arguments[0];
 		if( "bampath" in args )
 			{
 			document.getElementById('bampath').value = args.bam;
 			}
 		this.repaintSVGBam();
 		}
	}


Mozgv.prototype.onUnLoad = function()
	{
	this.settingsService.savePrefFile(this.settingsFile);
	}

var mozgv = new Mozgv();
