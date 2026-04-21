import { useEffect, useRef } from 'react'
import * as am5 from '@amcharts/amcharts5'
import * as am5map from '@amcharts/amcharts5/map'
import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow'
import { useAppSelector } from '../../app/hooks'
import { getEffectivePalette, getUiTheme } from '../constants/uiThemes'

interface TitleGlobeProps {
  size?: number
}

function hexToAm(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

function rgbTripletToHex(triplet: string): string {
  const [r, g, b] = triplet.split(',').map(s => parseInt(s.trim(), 10))
  return `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
}

export function TitleGlobe({ size = 32 }: TitleGlobeProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const landSeriesRef   = useRef<am5map.MapPolygonSeries | null>(null)
  const oceanSeriesRef  = useRef<am5map.MapPolygonSeries | null>(null)
  const rootRef         = useRef<am5.Root | null>(null)

  const selectedUiTheme = useAppSelector(s => s.mapStyle.selectedUiTheme)
  const uiMode          = useAppSelector(s => s.mapStyle.uiMode)

  // ── Create chart once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const root = am5.Root.new(containerRef.current)
    rootRef.current = root
    root.setThemes([])
    if (root._logo) root._logo.dispose()

    const palette = getEffectivePalette(getUiTheme(selectedUiTheme), uiMode)

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        projection: am5map.geoOrthographic(),
        panX: 'none',
        panY: 'none',
        wheelX: 'none',
        wheelY: 'none',
      })
    )

    // Ocean background
    const oceanSeries = chart.series.unshift(
      am5map.MapPolygonSeries.new(root, {})
    )
    oceanSeries.mapPolygons.template.setAll({
      fill:           am5.color(hexToAm(rgbTripletToHex(palette.bgRichRgb))),
      fillOpacity:    1,
      stroke:         am5.color(hexToAm(palette.accentHex)),
      strokeWidth:    0.5,
      strokeOpacity:  0.3,
    })
    oceanSeries.data.push({
      geometry: am5map.getGeoCircle({ latitude: 0, longitude: 0 }, 90),
    })
    oceanSeriesRef.current = oceanSeries

    // Land polygons
    const landSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_worldLow,
      })
    )
    landSeries.mapPolygons.template.setAll({
      fill:           am5.color(hexToAm(palette.activeStart)),
      fillOpacity:    0.85,
      stroke:         am5.color(hexToAm(palette.activeBorder)),
      strokeWidth:    0.3,
      strokeOpacity:  0.6,
    })
    landSeriesRef.current = landSeries

    // Spin animation
    chart.animate({
      key:      'rotationX',
      from:     0,
      to:       360,
      duration: 30000,
      loops:    Infinity,
      easing:   am5.ease.linear,
    })

    // Gentle tilt oscillation
    let tiltDir = 1
    const tilt = () => {
      chart.animate({
        key:      'rotationY',
        from:     chart.get('rotationY', -20),
        to:       tiltDir > 0 ? -10 : -30,
        duration: 8000,
        easing:   am5.ease.inOut(am5.ease.cubic),
      }).events.on('stopped', () => {
        tiltDir *= -1
        tilt()
      })
    }
    chart.set('rotationY', -20)
    tilt()

    return () => root.dispose()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update colors when theme changes ────────────────────────────────────────
  useEffect(() => {
    const land  = landSeriesRef.current
    const ocean = oceanSeriesRef.current
    if (!land || !ocean) return

    const palette = getEffectivePalette(getUiTheme(selectedUiTheme), uiMode)

    land.mapPolygons.template.setAll({
      fill:   am5.color(hexToAm(palette.activeStart)),
      stroke: am5.color(hexToAm(palette.activeBorder)),
    })

    ocean.mapPolygons.template.setAll({
      fill:   am5.color(hexToAm(rgbTripletToHex(palette.bgRichRgb))),
      stroke: am5.color(hexToAm(palette.accentHex)),
    })
  }, [selectedUiTheme, uiMode])

  return (
    <div
      ref={containerRef}
      className="title-globe"
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
    />
  )
}
