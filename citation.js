document.addEventListener('DOMContentLoaded', function () {
	var initDOI = getUrlVars()["doi"];
	if(initDOI) document.getElementById("doiInput").setAttribute("value",initDOI);
	
	getLocalMessages()
	buildSelections();
	startListeners();
}, false);

function startListeners() {
	jQuery('#citeForm').submit(function () {
		formSubmitHandler();
		return false;
	});
	jQuery('#copyButton').click(function() {   
		copyCitation()
	});
	
	document.getElementById('citeStyleInput').addEventListener('change', otherField, false);
}

// Read a page's GET URL variables and return them as an associative array.
// http://jquery-howto.blogspot.com/2009/09/get-url-parameters-values-with-jquery.html
function getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function buildSelections() {
	// LOCALES
	var storedLocale = localStorage["cite_locale"];
	var allLocales = ["sk-SK","uk-UA","de-AT","el-GR","th-TH","tr-TR","cs-CZ","hu-HU","sr-RS","fi-FI","ko-KR","lt-LT","vi-VN","bg-BG","en-US","he-IL","et-EE","zh-TW","de-CH","pt-BR","it-IT","sv-SE","is-IS","nb-NO","eu","af-ZA","ja-JP","hr-HR","ar-AR","sl-SI","ca-AD","ro-RO","nn-NO","fa-IR","de-DE","mn-MN","da-DK","es-ES","ru-RU","en-GB","pl-PL","nl-NL","km-KH","fr-FR","zh-CN","fr-CA","pt-PT"];
	
	if(allLocales.indexOf(storedLocale) < 0) {
		storedLocale = "en-US";
		localStorage["cite_locale"] = "en-US";
	}
	
	var readableLocales = [];
	for(var i=0; i < allLocales.length; i++) {
		readableLocales[i] = [allLocales[i], localeCodeToEnglish(allLocales[i])];
	}
	readableLocales.sort( function( a, b ) {
		if ( a[1] == b[1] ) return 0;
		return a[1] < b[1] ? -1 : 1;
	});
	
	var localeHtmlOptions = "";
	for(var i=0; i < allLocales.length; i++) {
		if(readableLocales[i][0] != storedLocale) {
			localeHtmlOptions += '<option value="' + readableLocales[i][0] + '">' + readableLocales[i][1] + '</option>';
		} else {
			localeHtmlOptions += '<option selected="selected" value="' + readableLocales[i][0] + '">' + readableLocales[i][1] + '</option>';
		}
	}
	document.getElementById('citeLocaleInput').innerHTML = localeHtmlOptions;
	
	// SHORT STYLES LIST
	var storedStyle = localStorage["cite_style"];
	var baseStyles = ["apa","bibtex","chicago-author-date","ieee","mla","nature","other"];
	var readableStyles = ["APA","BibTeX","Chicago","IEEE","MLA","Nature","Other"];

	if(baseStyles.indexOf(storedStyle) < 0) {
		storedStyle = "bibtex";
		localStorage["cite_style"] = "bibtex";
	}
	
	var styleHtmlOptions = "";
	for(var i=0; i < baseStyles.length; i++) {
		if(baseStyles[i] != storedStyle) {
			styleHtmlOptions += '<option value="' + baseStyles[i] + '">' + readableStyles[i] + '</option>';
		} else {
			styleHtmlOptions += '<option selected="selected" value="' + baseStyles[i] + '">' + readableStyles[i] + '</option>';
		}
	}
	document.getElementById('citeStyleInput').innerHTML = styleHtmlOptions;
	
	// FULL STYLES LIST
	var otherStoredStyle = localStorage["cite_other_style"];
	var allStyles = ["journal-of-vertebrate-paleontology","global-ecology-and-biogeography","international-journal-of-tropical-biology-and-conservation","catholic-biblical-association","fertility-and-sterility","water-environment-research","neurology","stem-cells","karger-journals","teologia-catalunya","national-archives-of-australia","american-journal-of-medical-genetics","limnology-and-oceanography","american-society-of-civil-engineers","oral-oncology","inter-ro","british-journal-of-political-science","ecology","acm-sigchi-proceedings","harvard1","energy-policy","embo-reports","trends-journal","pnas","hepatology","stem-cells-and-development","harvard-university-of-abertay-dundee","australian-journal-of-grape-and-wine-research","entomological-society-of-america","applied-spectroscopy","currents-in-biblical-research","vingtieme-siecle","institute-of-physics-numeric","institute-of-electronics-information-and-communication-engineers","oryx","molecular-psychiatry","mcgill-legal","radiopaedia","sexual-development","infoclio-fr-smallcaps","chinese-gb7714-2005-numeric","user-modeling-and-useradapted-interaction","the-open-university-numeric-superscript","global-change-biology","american-medical-association-no-url","gost-r-7-0-5-2008-numeric","fachhochschule-vorarlberg","kidney-international","systematic-biology","infoclio-de","molecular-ecology","blank","american-association-of-petroleum-geologists","american-society-of-mechanical-engineers","theory-culture-and-society","harvard1de","journal-of-lipid-research","organization-science","french4","soziale-welt","zootaxa","new-zealand-plant-protection","journal-of-the-american-society-of-nephrology","journal-of-clinical-endocrinology-and-metabolism","protein-science","chicago-author-date","american-journal-of-human-genetics","european-union-interinstitutional-style-guide","revista-brasileira-de-botanica","journal-of-the-american-association-of-laboratory-animal-science","societe-nationale-des-groupements-techniques-veterinaires","the-american-journal-of-psychiatry","language-in-society","international-journal-of-wildland-fire","lichenologist","chicago-author-date-de","disability-and-rehabilitation","fish-and-fisheries","cns-and-neurological-disorders-drug-targets","conservation-biology","oxford-art-journal","journal-of-clinical-oncology","harvard-university-of-the-west-of-england","invisu","toxicon","biological-psychiatry","bibtex","journal-of-antimicrobial-chemotherapy","journal-of-thrombosis-and-haemostasis","harvard-university-of-wolverhampton","elsevier-vancouver","leviathan","journal-of-management-information-systems","future-medicine-journals","acta-naturae","aquatic-conservation","neuropsychologia","elsevier-with-titles-alphabetical","basic-and-applied-ecology","journal-of-medical-genetics","histoire-et-mesure","copernicus-publications","journal-of-applied-ecology","iso690-numeric-sk","critical-care-medicine","universidad-evangelica-del-paraguay","international-studies-association","diplo","hawaii-international-conference-on-system-sciences-proceedings","apsa","philosophia-scientiae","iso690-author-date-en","coral-reefs","journal-of-superconductivity-and-novel-magnetism","journal-of-alzheimers-disease","elsevier-radiological","molecular-plant","proteomics","experimental-eye-research","pediatric-nephrology","cytometry","early-medieval-europe","journal-of-the-torrey-botanical-society","journal-of-social-archaeology","all","associacao-brasileira-de-normas-tecnicas-ufpr","analytica-chimica-acta","iso690-full-note-sk","chicago-fullnote-bibliography","elsevier-harvard","tissue-engineering","environmental-conservation","the-journal-of-comparative-neurology","american-journal-of-epidemiology","elsevier-without-titles","epidemiologie-et-sante-animale","administrative-science-quarterly","iso690-numeric-en","journal-of-forensic-sciences","the-historical-journal","avian-pathology","foerster-geisteswissenschaft","european-journal-of-information-systems","anesthesiology","tah-soz","association-for-computing-machinery","annals-of-botany","freshwater-biology","journal-of-management","australian-historical-studies","medical-physics","geological-society-of-america","entomologia-experimentalis-et-applicata","ornitologia-neotropical","journal-of-information-technology","journal-of-zoology","memorias-do-instituto-oswaldo-cruz","universite-de-liege-histoire","weed-science-society-of-america","new-england-journal-of-medicine","british-journal-of-industrial-relations","biochemical-journal","iica-catie","american-institute-of-aeronautics-and-astronautics","environmental-and-engineering-geoscience","un-eclac-cepal-spanish","journal-of-clinical-investigation","emerald-harvard","biophysical-journal","vancouver-superscript","harvard-staffordshire-university","geneses","angewandte-chemie","journal-of-field-ornithology","dendrochronologia","urban-habitats","soil-biology-biochemistry","byzantina-symmeikta","law1-de","pm-and-r","el-profesional-de-la-informacion","journal-of-the-royal-anthropological-institute","oscola-no-ibid","strahlentherapie-und-onkologie","heredity","institute-of-physics-harvard","american-journal-of-archaeology","osterreichische-zeitschrift-fur-politikwissenschaft","molecular-therapy","american-antiquity","conservation-letters","geoderma","veterinary-medicine-austria","mcgill-guide-v7","journal-of-studies-on-alcohol-and-drugs","international-journal-of-psychoanalysis","bluebook-inline","multidisciplinary-digital-publishing-institute","neuropsychopharmacology","microbial-ecology","ophthalmology","oncogene","the-open-university-numeric","evolution-and-development","knee-surgery-sports-traumatology-arthroscopy","the-journal-of-urology","harvard-sheffield","journal-of-hypertension","obesity","british-ecological-society","journal-of-fish-diseases","environmental-microbiology","apa5th","annals-of-the-association-of-american-geographers","the-isme-journal","vancouver-superscript-brackets-only-year","bluebook2","the-auk","brain","review-of-financial-studies","american-anthropological-association","small-wiley","science-translational-medicine","the-company-of-biologists","metallurgical-and-materials-transactions","cell-research","bulletin-of-marine-science","universita-di-bologna-lettere","centaurus","animal-behaviour","international-journal-of-radiation-oncology-biology-physics","american-society-for-microbiology","bioconjugate-chemistry","emu-austral-ornithology","acs-chemical-biology","socio-economic-review","mcrj7","macromolecular-reaction-engineering","the-open-university-a251","european-journal-of-neuroscience","spie-journals","moore-theological-college","vienna-legal","bulletin-de-la-societe-prehistorique-francaise","journal-of-biological-chemistry","human-mutation","canadian-journal-of-fisheries-and-aquatic-sciences","rofo","society-for-historical-archaeology","international-organization","blood","journal-of-archaeological-research","european-retail-research","environmental-health-perspectives","graefes-archive-clinical-and-experimental-ophthalmology","journal-of-applied-animal-science","molecular-biochemical-parasitology","allergy","harvard-limerick","american-medical-association","unctad-english","medicine-and-science-in-sports-and-exercise","oikos","hong-kong-journal-of-radiology","sociedade-brasileira-de-computacao","elsevier-harvard-without-titles","lettres-et-sciences-humaines-fr","council-of-science-editors","yeast","standards-in-genomic-sciences","international-journal-of-epidemiology","journal-of-tropical-ecology","us-geological-survey","journalistica","harvard-european-archaeology","natureza-e-conservacao","stroke","american-phytopathological-society-numeric","spie-bios","mla-underline","french2","briefings-in-bioinformatics","journal-of-food-protection","veterinary-radiology-and-ultrasound","clinical-otolaryngology","zookeys","optical-society-of-america","vancouver","mammal-review","harvard-university-of-birmingham","harvard-university-of-sunderland","water-research","neuroreport","acm-siggraph","the-american-journal-of-geriatric-pharmacotherapy","nano-biomedicine-and-engineering","acta-neurochirurgica","hamburg-school-of-food-science","who-europe-numeric","journal-of-the-academy-of-nutrition-and-dietetics","british-psychological-society","archives-of-physical-medicine-and-rehabilitation","gallia","associacao-brasileira-de-normas-tecnicas-ufmg-face-full","psychiatry-and-clinical-neurosciences","harvard-manchester-business-school","methods-information-medicine","hydrological-sciences-journal","ieee","springer-vancouver","oxford-brookes-university-faculty-of-health-and-life-sciences","journal-of-molecular-biology","clinical-orthopaedics-and-related-research","international-journal-of-production-economics","virology","bioorganic-and-medicinal-chemistry-letters","the-journal-of-the-acoustical-society-of-america","mbio","cellular-and-molecular-bioengineering","histoire-at-politique","evolution","oecologia","european-journal-of-emergency-medicine","frontiers","the-accounting-review","journal-of-investigative-dermatology","annual-reviews-alphabetically","information-communication-and-society","american-journal-of-respiratory-and-critical-care-medicine","gost-r-7-0-5-2008","acm-sig-proceedings","european-journal-of-nuclear-medicine-and-molecular-imaging","organic-geochemistry","cell","asian-studies-review","nature-neuroscience-brief-communication","rose-school","evolutionary-ecology","australian-journal-of-earth-sciences","turabian-fullnote-bibliography","heart-rhythm","universite-laval-com","harvard7de","international-journal-of-exercise-science","pontifical-athenaeum-regina-apostolorum","vancouver-author-date","traffic-injury-prevention","triangle","advanced-functional-materials","bmc-bioinformatics","bluebook-law-review","royal-society-of-chemistry","cell-calcium","international-journal-of-humanoid-robotics","american-journal-of-botany","livestock-science","asa-cssa-sssa","media-culture-and-society","international-union-of-crystallography","journal-of-applied-philosophy","lancet","american-veterinary-medical-association","journal-of-shoulder-and-elbow-surgery","journal-of-chemistry-and-chemical-engineering","polish-botanical-society","tu-wien-dissertation","journal-of-combinatorics","pediatric-blood-and-cancer","manchester-university-press","ecology-letters","vision-research","sbl-fullnote-bibliography","iso690-numeric-cs","marine-policy","investigative-radiology","progress-in-retinal-and-eye-research","bioelectromagnetics","unisa-harvard","asa","journal-of-psychiatry-and-neuroscience","wetlands","din-1505-2","juristische-zitierweise-deutsch","hypotheses-in-the-life-sciences","the-embo-journal","the-holocene","lethaia","molecular-psychiatry-letters","chest","revue-de-medecine-veterinaire","american-phytopathological-society","journal-of-comparative-physiology-a","american-journal-of-cardiology","american-journal-of-pathology","history-and-theory","journal-of-chemical-ecology","zeitschrift-fur-soziologie","tah-gkw","journal-of-visualized-experiments","body-and-society","harvard-institut-fur-praxisforschung-de","cuadernos-filologia-clasica","fems","social-science-and-medicine","journal-of-neurosurgery","advanced-materials","american-physiological-society","mla-url","chicago-note-biblio-no-ibid","the-pharmacogenomics-journal","journal-of-the-electrochemical-society","american-chemical-society-with-titles-brackets","harvard-anglia-ruskin","documenta-ophthalmologica","elsevier-harvard2","french-politics","medical-history","the-british-journal-of-psychiatry","research-policy","harvard-university-of-gloucestershire","bioinformatics","alternatives-to-animal-experimentation","multiple-sclerosis-journal","cancer-research","chicago-note-bibliography","acta-pharmaceutica","american-meteorological-society","romanian-humanities","zdravniski-vestnik","organization","javnost-the-public","the-american-journal-of-gastroenterology","journal-of-mammalogy","springer-plasmonics","gastroenterology","european-heart-journal","international-journal-of-hydrogen-energy","surgical-neurology-international","american-medical-association-no-et-al","oscola","annual-reviews-by-appearance","acs-nano","information-systems-research","harvard-kings-college-london","palaeontologia-electronica","kolner-zeitschrift-fur-soziologie-und-sozialpsychologie","antonie-van-leeuwenhoek","medecine-sciences","current-protocols","university-college-dublin-school-of-history-and-archives","acta-palaeontologica-polonica","council-of-science-editors-author-date","chicago-fullnote-bibliography-no-ibid","pain","annals-of-biomedical-engineering","scandinavian-journal-of-infectious-diseases","resources-conservation-and-recycling","european-cells-and-materials","biotropica","building-structure","science-without-title","northeastern-naturalist","microscopy-and-microanalysis","biotechnology-and-bioengineering","infoclio-fr-nocaps","unisa-harvard3","american-journal-of-orthodontics-and-dentofacial-orthopedics","plant-physiology","french1","journal-of-hepatology","febs-journal","bba-biochimica-et-biophysica-acta","amiens","journal-of-pharmacology-and-experimental-therapeutics","journal-of-marketing","iso690-numeric-lt","palaios","plos","current-opinion","stuttgart-media-university","who-europe-harvard","science","universite-laval-faculte-de-theologie-et-de-sciences-religieuses","aids","plant-biology","mla-notes","le-mouvement-social","american-heart-association","clinical-neurophysiology","clinical-cancer-research","vancouver-brackets","the-journal-of-immunology","journal-of-molecular-endocrinology","geological-magazine","arthritis-and-rheumatism","nanotechnology","ethics-book-reviews","geology","american-institute-of-physics","national-science-foundation-grant-proposals","the-journal-of-eukaryotic-microbiology","the-open-university-harvard","new-phytologist","aging-cell","society-for-general-microbiology","annals-of-oncology","journal-of-hellenic-studies","the-journal-of-physiology","drug-development-research","springer-protocols","journal-of-neurophysiology","immunological-reviews","journal-of-financial-economics","lncs","american-medical-association-alphabetical","harvard-university-of-leeds","eye","european-journal-of-immunology","culture-medicine-and-psychiatry","matej-bel-university-faculty-of-natural-sciences","art-history","the-journal-of-neuropsychiatry-and-clinical-neurosciences","austrian-legal","taylor-and-francis-harvard-x","journal-of-finance","hormone-and-metabolic-research","universitat-heidelberg-historisches-seminar","journal-of-community-health","clio-medica","paleobiology","american-chemical-society-with-titles","the-oncologist","padagogische-hochschule-heidelberg","journal-of-wildlife-diseases","journal-of-oral-and-maxillofacial-surgery","harvard-oxford-brookes-university","fold-and-r","the-american-naturalist","science-of-the-total-environment","rtf-scan","annales","cold-spring-harbor-laboratory-press","bone","european-journal-of-ophthalmology","national-library-of-medicine-grant","american-chemical-society","human-resource-management-journal","acta-ophthalmologica","harvard1-unisa-gbfe","inflammatory-bowel-diseases","georg-august-universitat-gottingen-institut-fur-ethnologie-und-ethnologische-sammlung","european-respiratory-journal","journal-of-the-american-college-of-cardiology","advanced-engineering-materials","annals-of-neurology","vancouver-superscript-only-year","journal-of-the-brazilian-chemical-society","quaternary-research","elsevier-with-titles","european-journal-of-clinical-microbiology-and-infectious-diseases","biochemistry","annalen-des-naturhistorischen-museums-wien","the-academy-of-management-review","journal-of-the-air-and-waste-management-association","traffic","the-neuroscientist","acta-universitatis-agriculturae-sueciae","vancouver-brackets-no-et-al","cancer-chemotherapy-and-pharmacology","nucleic-acids-research","harvard-cardiff-university","antarctic-science","unified-style-linguistics","journal-of-evolutionary-biology","journal-of-dental-research","british-journal-of-anaesthesia","ecosystems","associacao-brasileira-de-normas-tecnicas-ipea","university-of-melbourne","sage-harvard","pediatric-research","apa-tr","iso690-author-date-fr","molecular-phylogenetics-and-evolution","chicago-annotated-bibliography","biomed-central","arzneimitteltherapie","associacao-brasileira-de-normas-tecnicas-note","behavioral-ecology-and-sociobiology","the-plant-journal","scandinavian-journal-of-clinical-and-laboratory-investigation","society-for-american-archaeology","ear-and-hearing","journal-of-the-american-academy-of-orthopaedic-surgeons","australian-legal","austral-ecology","pontifical-biblical-institute","associacao-brasileira-de-normas-tecnicas","chicago-library-list","american-geophysical-union","genome-biology-and-evolution","traces","american-physics-society","acm-sig-proceedings-long-author-list","environmental-and-experimental-botany","un-eclac-cepal-english","proceedings-of-the-royal-society-b","french3","rockefeller-university-press","hydrogeology-journal","ergoscience","anesthesia-and-analgesia","british-journal-of-pharmacology","revue-dhistoire-moderne-et-contemporaine","urban-studies","spip-cite","bioresource-technology","international-journal-of-solids-and-structures","chinese-gb7714-1987-numeric","european-journal-of-radiology","american-journal-of-physical-anthropology","journal-of-orthopaedic-trauma","harvard-imperial-college-london","british-journal-of-haematology","bmj","journal-of-pragmatics","oxford-university-new-south-wales","acta-materialia","hwr-berlin","equine-veterinary-education","harvard-leeds-metropolitan-university","journal-of-pollination-ecology","springer-author-date","journal-of-perinatal-medicine","advances-in-complex-systems","plant-cell","international-pig-veterinary-society-congress-proceedings","journal-of-paleontology","irish-historical-studies","fungal-ecology","harvard3","associacao-brasileira-de-normas-tecnicas-ufmg-face-initials","cell-numeric","politische-vierteljahresschrift","social-studies-of-science","avian-diseases","iso690-numeric-fr","revue-archeologique","water-science-and-technology","hand","journal-of-hearing-science","harvard-sheffield1","cerebral-cortex","meteoritics-and-planetary-science","new-zealand-veterinary-journal","gost-r-7-0-5-2008-csl-1-0","health-services-research","biotechniques","kritische-ausgabe","wheaton-college-phd-in-biblical-and-theological-studies","cell-transplantation","tgm-wien-diplom","the-open-university-m801","neurology-india","poultry-science","karger-journals-author-date","magnetic-resonance-in-medicine","international-journal-of-audiology","palaeontology","language","history-of-the-human-sciences","european-journal-of-soil-science","metabolic-engineering","mis-quarterly","circulation","north-west-university-harvard","journal-of-geography-in-higher-education","climate-dynamics","new-solutions","pharmacoeconomics","international-journal-of-cancer","veterinary-record","bioessays","drugs-of-today","lncs2","journal-of-health-economics","journal-of-bacteriology","mhra","political-studies","journal-of-orthopaedic-research","taylor-and-francis-reference-style-f","geopolitics","physiological-and-biochemical-zoology","chemical-senses","the-journal-of-neuroscience","scandinavian-political-studies","inter-research-science-center","cities","harvard-university-west-london","journal-of-petrology","nature","journal-of-industrial-ecology","sage-vancouver","neurorehabilitation-and-neural-repair","zeitschrift-fur-medienwissenschaft","journal-of-the-american-water-resources-association","iso690-author-date-cs","clinical-pharmacology-and-therapeutics","molecular-microbiology","geochimica-et-cosmochimica-acta","wceam2010","journal-of-wildlife-management","ieee-w-url","ecoscience","genetics","metropolitiques","chicago-author-date-basque","climatic-change","british-journal-of-cancer","transportation-research-record","journal-of-biogeography","presses-universitaires-de-rennes","molecular-biology-and-evolution","earth-surface-processes-and-landforms","journal-of-elections-public-opinion-and-parties","bone-marrow-transplantation","nature-no-superscript","din-1505-2-numeric","din-1505-2-alphanumeric","world-journal-of-biological-psychiatry","kindheit-und-entwicklung","apa","the-condor","the-british-journal-of-sociology","urban-forestry-and-urban-greening","chemical-research-in-toxicology","methods-in-ecology-and-evolution","public-health-nutrition","american-journal-of-political-science","environmental-toxicology-and-chemistry","spanish-legal","les-journees-de-la-recherche-porcine","international-microbiology","clinical-infectious-diseases","harvard-university-of-northampton","cancer-and-metastasis-reviews","mla","aviation-space-and-environmental-medicine","the-astrophysical-journal"].sort();
	
	if(allStyles.indexOf(otherStoredStyle) < 0) {
		otherStoredStyle = "bibtex";
		localStorage["cite_other_style"] = "bibtex";
	}
	
	var otherStyleHtmlOptions = "";
	for(var i=0; i < allStyles.length; i++) {
		if(allStyles[i] != otherStoredStyle) {
			otherStyleHtmlOptions += '<option value="' + allStyles[i] + '">' + allStyles[i] + '</option>';
		} else {
			otherStyleHtmlOptions += '<option selected="selected" value="' + allStyles[i] + '">' + allStyles[i] + '</option>';
		}
	}
	document.getElementById('styleList').innerHTML = otherStyleHtmlOptions;
	
	var sideFormElm = document.getElementById('sideForm');
	if(storedStyle == "other") sideFormElm.style.display = "block";
}

function otherField() {
	var elm = document.getElementById('citeStyleInput');
	var style = elm.options[elm.selectedIndex].value;
	var sideFormElm = document.getElementById('sideForm');
	
	if(style == "other") sideFormElm.style.display = "block";
	else sideFormElm.style.display = "none";
}

function trim(stringToTrim) {
	return stringToTrim.replace(/doi:|\s+|[\.!\?,]$|[\.!\?,]\s+$/g,"");
}

function formSubmitHandler() {
	var doi = escape(trim(document.getElementById("doiInput").value));
	if(!doi || !checkValidDoi(doi)) return;
	
	saveSelections();
	getCitation(doi);
}

function saveSelections() {
	var citeStyle = document.getElementById("citeStyleInput");
	localStorage["cite_style"] = citeStyle.options[citeStyle.selectedIndex].value;
	var citeLocale = document.getElementById("citeLocaleInput");
	localStorage["cite_locale"] = citeLocale.options[citeLocale.selectedIndex].value;
	var otherStyleElm = document.getElementById("styleList");
	localStorage["cite_other_style"] = otherStyleElm.options[otherStyleElm.selectedIndex].value;
}

function checkValidDoi(doiInput) {
	if(doiInput.match(/^10\./)) {
		return true;
	} else if(doiInput.match(/^10\//)) {
		return true;
	} else {
		notification(chrome.i18n.getMessage("invalidDoiAlert"));
		return false;
	}
}

function resetSpace() {
	var notifyElm = document.getElementById("notifyDiv");
	var citeElm = document.getElementById("citeDiv");
	var citeOutElm = document.getElementById("citeOutput");
	
	notifyElm.innerHTML = "";
	citeOutElm.innerHTML = "";
	
	notifyElm.style.display = "none";
	citeElm.style.display = "none";
}

function notification(message) {
	resetSpace();

	var notifyElm = document.getElementById("notifyDiv");
	notifyElm.style.display = "block";
	notifyElm.innerHTML = message;
}

function outputCitation(message) {
	resetSpace();
	
	var citeElm = document.getElementById("citeDiv");
	var citeOutElm = document.getElementById("citeOutput");
	
	citeElm.style.display = "block";
	citeOutElm.innerHTML = message;
}

function copyCitation() {
	jQuery("#citeOutput").select();
    document.execCommand('copy');
	jQuery("#citeOutput").select();
}

function htmlEscape(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function getCitation(doi) {
	var styleElm = document.getElementById("citeStyleInput");
	var style = styleElm.options[styleElm.selectedIndex].value;
	var localeElm = document.getElementById("citeLocaleInput");
	var locale = localeElm.options[localeElm.selectedIndex].value;
	
	if(style == "other") {
		var otherStyleElm = document.getElementById("styleList");
		style = otherStyleElm.options[otherStyleElm.selectedIndex].value;
	}
	
	var resolveUrl = "http://dx.doi.org/" + doi;
	var content = "text/x-bibliography; style=" + style + "; locale=" + locale;
	
	notification(chrome.i18n.getMessage("loading"));
	
	chrome.permissions.request({
		origins: [ 'http://*.doi.org/', 'http://*.crossref.org/', 'http://*.datacite.org/' ]
	}, function(granted) {
		if(granted) {
			var jqxhr = jQuery.ajax({
				url: resolveUrl,
				headers: { Accept: content },
				dataType: "text",
				type: "GET",
				cache: false
			});
			jqxhr.done(function() {
				if(jqxhr.responseText != "") outputCitation(htmlEscape(jqxhr.responseText));
				else notification(chrome.i18n.getMessage("noCitationFound"));
			});
			jqxhr.error(function() {
				notification(chrome.i18n.getMessage("noCitationFound"));
			});
		} else {
			notification(chrome.i18n.getMessage("needCitationPerm"));
		}
	});
}

function getLocalMessages() {
	var message = chrome.i18n.getMessage("citeTitle");
	document.getElementById("heading").innerHTML = message;
	message = chrome.i18n.getMessage("citeStyle");
	document.getElementById("citeStyleLabel").innerHTML = message;
	message = chrome.i18n.getMessage("citeLocale");
	document.getElementById("citeLocaleLabel").innerHTML = message;
}