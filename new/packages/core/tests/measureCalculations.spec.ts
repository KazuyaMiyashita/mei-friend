import { JSDOM } from 'jsdom'
import { beforeEach, describe, expect, it } from 'vitest'
import { MEI_NS } from '../src/mei/MeiDocument'
import {
  getActiveMeter,
  getDurationAndOffset,
  getMeasureModel,
} from '../src/mei/measureCalculations'

const sampleMei = `
<mei xmlns="${MEI_NS}">
  <music>
    <body>
      <mdiv>
        <score>
          <scoreDef>
            <meterSig count="4" unit="4"/>
          </scoreDef>
          <section>
            <measure xml:id="m1" n="1">
              <staff n="1">
                <layer n="1" xml:id="l1">
                  <note xml:id="n1" dur="4"/>
                  <note xml:id="n2" dur="8" dots="1"/>
                  <note xml:id="n3" dur="16"/>
                  <chord dur="2" xml:id="c1">
                    <note xml:id="n4"/>
                    <note xml:id="n5"/>
                  </chord>
                </layer>
              </staff>
            </measure>
            <measure xml:id="m2" n="2">
              <staff n="1">
                <layer n="1">
                  <mRest xml:id="mr1"/>
                </layer>
              </staff>
            </measure>
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>
`

describe('measureCalculations', () => {
  let doc: Document

  beforeEach(() => {
    const dom = new JSDOM(sampleMei, { contentType: 'text/xml' })
    doc = dom.window.document
  })

  it('should calculate duration and offset correctly', () => {
    const res1 = getDurationAndOffset(doc, 'n1')
    expect(res1?.duration.toNumber()).toBe(1)
    expect(res1?.offset.toNumber()).toBe(0)

    const res2 = getDurationAndOffset(doc, 'n2')
    expect(res2?.duration.toNumber()).toBe(0.75)
    expect(res2?.offset.toNumber()).toBe(1)

    const res3 = getDurationAndOffset(doc, 'n3')
    expect(res3?.duration.toNumber()).toBe(0.25)
    expect(res3?.offset.toNumber()).toBe(1.75)

    const res4 = getDurationAndOffset(doc, 'n4')
    expect(res4?.duration.toNumber()).toBe(2)
    expect(res4?.offset.toNumber()).toBe(2)
  })

  it('should build measure model correctly', () => {
    const measureMap = getMeasureModel(doc, 'm1')
    const layer1 = measureMap.get('l1')
    expect(layer1).toBeDefined()
    expect(layer1?.notes.length).toBe(4)
    expect(layer1?.meter?.count).toBe(4)
    expect(layer1?.notes[3].id).toBe('c1')
    expect(layer1?.notes[3].duration.toNumber()).toBe(2)
  })

  it('should handle mRest correctly when meter is present', () => {
    const measureMap = getMeasureModel(doc, 'm2')
    const layers = Array.from(measureMap.values())
    expect(layers[0].notes[0].duration.toNumber()).toBe(4)
  })

  it('should return null when no meterSig is present', () => {
    const noMeterMei = `<mei xmlns="${MEI_NS}"><music><body><mdiv><score><section><measure xml:id="m3"/></section></score></mdiv></body></music></mei>`
    const dom = new JSDOM(noMeterMei, { contentType: 'text/xml' })
    const m3 = dom.window.document.querySelector('measure')
    if (!m3) throw new Error('measure not found')
    expect(getActiveMeter(m3)).toBeNull()
  })
})
