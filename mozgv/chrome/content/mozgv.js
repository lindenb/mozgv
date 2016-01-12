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

function parsePosition()
	{
	var s =  document.getElementById("interval").value;
	var colon=s.indexOf(':');
	if(colon<1)
		{
		console.log("bad colon "+s);
		return null;
		}
	var chrom = s.substr(0,colon);
	var start = 0;
	var end = 0;
	s = s.substr(colon+1);
	var hyphen= s.indexOf('-');
	if( hyphen == -1 )
		{
		start = parseInt(s.replace(/[,]/g, '') );
		end = start;
		console.log("start "+start+" "+end);
		}
	else
		{
		start = parseInt( s.substr(0,hyphen).replace(/[,]/g, '') );
		end = parseInt( s.substr(hyphen+1).replace(/[,]/g, '') );
		}
	
	if(chrom.length==0 || isNaN(start) || start <0  || isNaN(end) || end < start)
		{
		console.log("bad "+ret.chrom+"/"+ start);
		return null;
		}
	if(start+100<end) end=start+100;
	return new Interval(chrom,start,end);
	}

function moveView(side,percent)
	{
	var interval = parsePosition();
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
	repaintSVGBam();
	}

function getSamtoolsPath()
	{
	return "/home/lindenb/package/samtools-0.1.19/samtools";
	}

function paintError(err)
	{
	var svg= document.getElementById("drawingArea");
	while ( svg.hasChildNodes()) svg.removeChild(svg.firstChild);
	var message = SVG.createText(0,12,""+err);
	svg.setAttribute("width","100");
	svg.setAttribute("height","100");
	svg.appendChild(message);
	message.setAttribute("style","stroke:red;fill:none;font-size:12;");
	}

function repaintSVGBam()
	{
	var bamExeFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces["nsILocalFile"]);
	bamExeFile.initWithPath( getSamtoolsPath() );
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

					  var samfileStr = NetUtil.readInputStreamToString(inputStream, inputStream.available());
					  var reads=[];
					  var lines = samfileStr.split(/\n/);
						for(var i in lines) {
						 if(lines[i].length==0 || lines[i].charAt(0)=='@') continue;
						 var rec = SamRecord.parse(lines[i]);
						 reads.push(rec);
						}
						samfileStr=null;
						var viewer = new  SVGBrowser();
						var svgRoot= document.getElementById("drawingArea");
						while ( svgRoot.hasChildNodes()) svgRoot.removeChild(svgRoot.firstChild);
						viewer.build(
							svgRoot,
							new Interval("chr1",3237,3247),
							reads,
							null);
					  tmpOutFile.remove(false);
					});
					
					break;
                case "process-failed":
                	paintError("Process failed "+tmpOutFile.path); 
                	tmpOutFile.remove(false);
                	break;
            }
        }
    };
    
    var args=["view","-F","4","-o",tmpOutFile.path,"/home/lindenb/tmp/DATASANGER/sorted_.bam","chr1:3237-3247"];
     process.runAsync(args, args.length,observeHandler,false);
	}
	
function selectReferenceFile() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
nsIFilePicker);
	fp.appendFilter("Fasta Files (*.fa, *.fasta)","*.fa; *.fasta");
	fp.appendFilter("All Files" ,"*.*");
	fp.init(window, "Select a Reference File.", nsIFilePicker.modeOpen);
	var res = fp.show();
	if (res != nsIFilePicker.returnCancel){
		document.getElementById('refpath').value = fp.file.path;
		repaintSVGBam();
		}
	}

function selectBamFile() {
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(
nsIFilePicker);
	fp.appendFilter("BAM Files (*.bam, *.cram)","*.bam; *.cram");
	fp.appendFilter("All Files" ,"*.*");
	fp.init(window, "Select a BAM File.", nsIFilePicker.modeOpen);
	var res = fp.show();
	if (res != nsIFilePicker.returnCancel){
		document.getElementById('bampath').value = fp.file.path;
		repaintSVGBam();
		}
	}

