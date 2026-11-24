// A field value that expands inline, without another framed section.
export function fieldDisclosure(ui,label,summaryText){
 const disclosure=document.createElement("details"),summary=document.createElement("summary"),body=document.createElement("div");
 disclosure.className="ui-field-disclosure";summary.className="ui-field-disclosure__toggle";body.className="ui-field-disclosure__body";summary.textContent=summaryText;
 disclosure.append(summary,body);
 return {...ui.fieldRow(label,disclosure),disclosure,summary,body};
}
