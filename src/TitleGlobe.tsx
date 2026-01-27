import { useEffect, useRef } from 'react'
import * as am5 from '@amcharts/amcharts5'
import * as am5map from '@amcharts/amcharts5/map'
import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow'

interface TitleGlobeProps {
  size?: number
}

export function TitleGlobe({ size = 32 }: TitleGlobeProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<am5.Root | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // Create root
    const root = am5.Root.new(chartRef.current)
    rootRef.current = root

    // Disable amCharts logo
    root.setThemes([])
    
    // Remove the amCharts logo
    if (root._logo) {
      root._logo.dispose()
    }

    // Create chart
    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        projection: am5map.geoOrthographic(),
        panX: 'none',
        panY: 'none',
        wheelX: 'none',
        wheelY: 'none'
      })
    )

    // Create polygon series for countries
    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_worldLow
      })
    )

    // Style the polygons with purple theme
    polygonSeries.mapPolygons.template.setAll({
      fill: am5.color(0xa855f7),
      fillOpacity: 0.8,
      stroke: am5.color(0xc084fc),
      strokeWidth: 0.3,
      strokeOpacity: 0.6
    })

    // Add background (ocean)
    const backgroundSeries = chart.series.unshift(
      am5map.MapPolygonSeries.new(root, {})
    )

    backgroundSeries.mapPolygons.template.setAll({
      fill: am5.color(0x2d1f42),
      fillOpacity: 1,
      stroke: am5.color(0x8a5ca8),
      strokeWidth: 0.5,
      strokeOpacity: 0.3
    })

    backgroundSeries.data.push({
      geometry: am5map.getGeoCircle({ latitude: 0, longitude: 0 }, 90)
    })

    // Animate rotation
    chart.animate({
      key: 'rotationX',
      from: 0,
      to: 360,
      duration: 30000,
      loops: Infinity,
      easing: am5.ease.linear
    })

    // Slow gentle tilt animation
    let tiltDirection = 1
    const tiltAnimation = () => {
      chart.animate({
        key: 'rotationY',
        from: chart.get('rotationY', -20),
        to: tiltDirection > 0 ? -10 : -30,
        duration: 8000,
        easing: am5.ease.inOut(am5.ease.cubic)
      }).events.on('stopped', () => {
        tiltDirection *= -1
        tiltAnimation()
      })
    }
    chart.set('rotationY', -20)
    tiltAnimation()

    return () => {
      root.dispose()
    }
  }, [])

  return (
    <div
      ref={chartRef}
      className="title-globe"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0
      }}
    />
  )
}
