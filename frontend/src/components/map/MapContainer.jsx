/**
 * MapContainer
 * Renders Mappls (MapmyIndia) map.
 */

import { useEffect, useRef, useState } from 'react'
import { useMapplsLoader } from '../../hooks/useMapplsLoader'
import { Spinner, ErrorBanner } from '../common/UI'
import { pciColor } from '../../utils/helpers'

const BENGALURU_CENTER = [12.9716, 77.5946]

export default function MapContainer({
  heatmapPoints = [],
  hotspots = [],
  showHeatmap = true,
  showMarkers = true,
  onHotspotClick,
  height = '100%',
  zoom = 11,
}) {

  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  const heatmapRef = useRef(null)
  const markersRef = useRef([])

  const [mapError, setMapError] = useState(null)

  const { ready, error } = useMapplsLoader()


  /**
   * Initialize Map
   */
  useEffect(() => {

    if (!ready || !mapRef.current || mapInstance.current)
      return

    const M = window.mappls

    if (!M) {
      setMapError('Mappls SDK not loaded')
      return
    }

    if (typeof M.Map !== 'function') {
      setMapError('Mappls.Map is unavailable')
      return
    }


    try {

      mapInstance.current = new M.Map(
        mapRef.current.id,
        {
          center: BENGALURU_CENTER,
          zoom,
          minZoom: 8,
          maxZoom: 18,
          backgroundColor: '#0d1117',
        }
      )


      setMapError(null)

    } catch (err) {

      console.error("Map init failed:", err)

      if (err.message?.includes("tileUrl")) {
        setMapError(
          "Invalid Mappls API key. Check VITE_MAPPLS_MAP_SDK_KEY"
        )
      }
      else {
        setMapError(err.message)
      }

    }


  }, [ready])



  /**
   * Heatmap Layer
   */
  useEffect(() => {

    if (
      !mapInstance.current ||
      !heatmapPoints.length ||
      !showHeatmap
    )
      return


    const M = window.mappls


    try {

      // cleanup old layer
      if (heatmapRef.current) {
        try {
          heatmapRef.current.setMap(null)
        }
        catch { }
      }


      const data = heatmapPoints.map(p => ({
        location: new M.LatLng(
          p.lat,
          p.lng
        ),

        weight:
          Math.min(
            Math.max(
              (p.weight ?? 0) / 100,
              0
            ),
            1
          )
      }))



      heatmapRef.current =
        new M.HeatmapLayer({

          map: mapInstance.current,

          data,

          options: {

            radius: 25,

            opacity: 0.8,

            gradient: {
              0.0: '#22c55e',
              0.4: '#eab308',
              0.7: '#f97316',
              1.0: '#ef4444',
            }

          }

        })


    } catch (err) {
      console.error(
        "Heatmap creation failed:",
        err
      )
    }


  }, [
    heatmapPoints,
    showHeatmap,
    ready
  ])




  /**
   * Markers
   */
  useEffect(() => {

    if (
      !mapInstance.current ||
      !hotspots.length ||
      !showMarkers
    )
      return


    const M = window.mappls


    try {


      // remove previous markers
      markersRef.current.forEach(marker => {

        try {
          marker.setMap(null)
        }
        catch { }

      })


      markersRef.current = []



      hotspots
        .slice(0, 200)
        .forEach(hs => {
          try {
            const color =
              pciColor(
                hs.pci_label
              )
            const marker =
              new M.Marker({
                map:
                  mapInstance.current,


                position: [
                  hs.center_lat,
                  hs.center_lon
                ],



                html: `
              <div style="
                width:14px;
                height:14px;
                background:${color};
                border-radius:50%;
                border:2px solid white;
                cursor:pointer;
                box-shadow:
                  0 0 8px ${color};
              ">
              </div>
            `,


                popupHtml: `

            <div style="
              min-width:180px;
              font-family:Inter;
              font-size:12px;
              color:#0d1117;
            ">


            <b>
              ${hs.junction_name ||
                  "Cluster #" + hs.cluster_id
                  }
            </b>


            <p>
              ${hs.police_station ?? ""}
            </p>


            <p>
              Violations:
              <b>
                ${hs.violation_count
                    ?.toLocaleString()
                  }
              </b>
            </p>



            <p>
              PCI:

              <b style="
                color:${color}
              ">

              ${hs.pci_score
                    ?.toFixed(1)
                  }

              -
              ${hs.pci_label}

              </b>
            </p>


            </div>

            `

              })



            marker.addListener(
              "click",
              () => {

                onHotspotClick?.(hs)

              }
            )


            markersRef.current.push(
              marker
            )


          }
          catch (err) {
            console.error(
              "Marker creation failed:",
              err
            )

          }



        })



    } catch (err) {

      console.error(
        "Marker rendering failed:",
        err
      )

    }


  }, [
    hotspots,
    showMarkers,
    ready,
    onHotspotClick
  ])





  /**
   * Error UI
   */
  if (error || mapError) {

    return (

      <div className="p-6">

        <ErrorBanner
          message={
            error || mapError
          }
        />


        <p className="
          mt-3 text-xs text-pp-muted
        ">

          Check your Mappls API key:

          <a
            href="https://apis.mappls.com/console/"
            target="_blank"
            rel="noreferrer"
            className="
              text-pp-accent underline
            "
          >
            Mappls Console
          </a>

        </p>

      </div>

    )

  }





  return (

    <div
      style={{
        height,
        position: 'relative'
      }}
    >


      {!ready && (

        <div className="
          absolute inset-0
          flex items-center justify-center
          bg-pp-surface
          z-10 rounded-xl
        ">

          <Spinner />

        </div>

      )}



      <div

        ref={mapRef}

        id="parkpulse-map"

        style={{
          width: '100%',
          height: '100%'
        }}

      />

    </div>

  )

}