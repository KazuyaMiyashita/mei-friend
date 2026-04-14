import { MEI_NS, parseXml, XML_NS, xmlToString } from './MeiDocument'
import { generateXmlId } from './meiUtils'

export interface ScoreConfig {
  title: string
  tempo: string
  ensemble: 'four-part-harmony' // For future extension
  keySig: string // e.g. "3s", "2f", "0"
  mode: 'major' | 'minor'
  meterCount: string // e.g. "4"
  meterUnit: string // e.g. "4"
}

export function generateEmptyMEI(config: ScoreConfig): string {
  const { title, tempo, keySig, mode, meterCount, meterUnit } = config
  const date = new Date().toISOString().split('T')[0]

  // Template string (xml:id is not included as it will be assigned dynamically later)
  const template = `<?xml version='1.0' encoding='UTF-8'?>
<mei meiversion="5.1" xmlns="${MEI_NS}">
   <meiHead>
      <fileDesc>
         <titleStmt>
            <title>${escapeXml(title)}</title>
            <respStmt/>
         </titleStmt>
         <pubStmt>
            <date isodate="${date}" type="encoding-date">${date}</date>
         </pubStmt>
      </fileDesc>
   </meiHead>
   <music>
      <body>
         <mdiv>
            <score>
               <scoreDef>
                  <staffGrp>
                     <staffGrp bar.thru="true">
                        <grpSym symbol="bracket"/>
                        <staffDef n="1" lines="5" ppq="256">
                           <label>Soprano</label>
                           <clef shape="C" line="1"/>
                           <keySig mode="${mode}" sig="${keySig}"/>
                           <meterSig count="${meterCount}" unit="${meterUnit}"/>
                        </staffDef>
                        <staffDef n="2" lines="5" ppq="256">
                           <label>Alto</label>
                           <clef shape="C" line="3"/>
                           <keySig mode="${mode}" sig="${keySig}"/>
                           <meterSig count="${meterCount}" unit="${meterUnit}"/>
                        </staffDef>
                        <staffDef n="3" lines="5" ppq="256">
                           <label>Tenor</label>
                           <clef shape="C" line="4"/>
                           <keySig mode="${mode}" sig="${keySig}"/>
                           <meterSig count="${meterCount}" unit="${meterUnit}"/>
                        </staffDef>
                        <staffDef n="4" lines="5" ppq="256">
                           <label>Bass</label>
                           <clef shape="F" line="4"/>
                           <keySig mode="${mode}" sig="${keySig}"/>
                           <meterSig count="${meterCount}" unit="${meterUnit}"/>
                        </staffDef>
                     </staffGrp>
                  </staffGrp>
               </scoreDef>
               <section>
                  <measure n="1" right="end">
                     <tempo staff="1" tstamp="1">
                        <rend>${escapeXml(tempo)}</rend>
                     </tempo>
                     <staff n="1">
                        <layer n="1">
                           <mSpace/>
                        </layer>
                     </staff>
                     <staff n="2">
                        <layer n="1">
                           <mSpace/>
                        </layer>
                     </staff>
                     <staff n="3">
                        <layer n="1">
                           <mSpace/>
                        </layer>
                     </staff>
                     <staff n="4">
                        <layer n="1">
                           <mSpace/>
                        </layer>
                     </staff>
                  </measure>
               </section>
            </score>
         </mdiv>
      </body>
   </music>
</mei>`

  const doc = parseXml(template)
  if (!doc) throw new Error('Failed to parse MEI template')

  // Traverse all elements and assign xml:id
  const elements = doc.getElementsByTagName('*')
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (!el.hasAttributeNS(XML_NS, 'id') && !el.hasAttribute('xml:id')) {
      // Using the first character of the tag name as a prefix
      const prefix = el.tagName.charAt(0).toLowerCase()
      el.setAttributeNS(XML_NS, 'id', generateXmlId(prefix))
    }
  }

  return xmlToString(doc)
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return c
    }
  })
}
