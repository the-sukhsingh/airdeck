export namespace main {
	
	export class SessionInfo {
	    roomId: string;
	    passcode: string;
	    localIps: string[];
	    signalingPort: number;
	    presentationName: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.roomId = source["roomId"];
	        this.passcode = source["passcode"];
	        this.localIps = source["localIps"];
	        this.signalingPort = source["signalingPort"];
	        this.presentationName = source["presentationName"];
	    }
	}

}

export namespace storage {
	
	export class SlideData {
	    index: number;
	    title: string;
	    notes: string;
	    texts?: string[];
	
	    static createFrom(source: any = {}) {
	        return new SlideData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.title = source["title"];
	        this.notes = source["notes"];
	        this.texts = source["texts"];
	    }
	}
	export class Presentation {
	    id: string;
	    name: string;
	    source: string;
	    filePath?: string;
	    googleSlidesUrl?: string;
	    isStarred: boolean;
	    folder: string;
	    totalSlides: number;
	    slides: SlideData[];
	    createdAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Presentation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.source = source["source"];
	        this.filePath = source["filePath"];
	        this.googleSlidesUrl = source["googleSlidesUrl"];
	        this.isStarred = source["isStarred"];
	        this.folder = source["folder"];
	        this.totalSlides = source["totalSlides"];
	        this.slides = this.convertValues(source["slides"], SlideData);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Settings {
	    theme: string;
	    pairedDevices: string[];
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.pairedDevices = source["pairedDevices"];
	    }
	}

}

