"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Camera } from "lucide-react"

type FilterType = "90s" | "2000s" | "Noir" | "Fisheye" | "Rainbow" | "Glitch" | "Crosshatch"

interface CapturedPhoto {
  dataUrl: string
  timestamp: number
}

export default function PhotoBoothApp() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([])
  const [currentFilter, setCurrentFilter] = useState<FilterType>("2000s")
  const [showPhotoStrip, setShowPhotoStrip] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCurtains, setShowCurtains] = useState(true)
  const [curtainsAnimating, setCurtainsAnimating] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoStripCanvasRef = useRef<HTMLCanvasElement>(null)

  const availableFilters: { name: FilterType; label: string; css: string }[] = [
    { name: "90s", label: "90s", css: "sepia(0.8) saturate(1.4) hue-rotate(315deg) brightness(1.1)" },
    { name: "2000s", label: "2000s", css: "saturate(1.6) contrast(1.2) brightness(1.1) hue-rotate(10deg)" },
    { name: "Noir", label: "Noir", css: "grayscale(1) contrast(1.3) brightness(0.9)" },
    { name: "Fisheye", label: "Fisheye", css: "contrast(1.2) saturate(1.3)" },
    { name: "Rainbow", label: "Rainbow", css: "hue-rotate(180deg) saturate(2) brightness(1.2)" },
    { name: "Glitch", label: "Glitch", css: "hue-rotate(90deg) saturate(2) contrast(1.5)" },
    { name: "Crosshatch", label: "Crosshatch", css: "contrast(1.4) brightness(0.8) saturate(0.8)" },
  ]

  const backgroundClouds = [
    { width: 80, height: 50, left: 10, top: 15 },
    { width: 120, height: 70, left: 25, top: 8 },
    { width: 90, height: 55, left: 45, top: 20 },
    { width: 110, height: 65, left: 65, top: 12 },
    { width: 85, height: 45, left: 80, top: 25 },
    { width: 95, height: 60, left: 15, top: 45 },
    { width: 130, height: 75, left: 35, top: 40 },
    { width: 75, height: 40, left: 55, top: 50 },
    { width: 100, height: 55, left: 75, top: 35 },
    { width: 115, height: 70, left: 5, top: 70 },
    { width: 90, height: 50, left: 30, top: 75 },
    { width: 105, height: 65, left: 50, top: 80 },
    { width: 80, height: 45, left: 70, top: 65 },
    { width: 125, height: 80, left: 85, top: 75 },
  ]

  const initializePhotoBooth = async () => {
    setCurtainsAnimating(true)
    setTimeout(() => {
      setShowCurtains(false)
      requestCameraAccess()
    }, 2000)
  }

  const requestCameraAccess = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported by this browser")
      }

      const cameraConfigs = [
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
        {
          video: {
            width: 640,
            height: 480,
          },
          audio: false,
        },
      ]

      let mediaStream = null
      let lastError = null

      for (const config of cameraConfigs) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(config)
          break
        } catch (error) {
          lastError = error
          continue
        }
      }

      if (!mediaStream) {
        throw lastError || new Error("Could not access camera")
      }

      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error("Video element not found"))
            return
          }

          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current
                .play()
                .then(() => resolve(true))
                .catch(reject)
            }
          }

          videoRef.current.onerror = (error) => {
            reject(error)
          }

          setTimeout(() => {
            reject(new Error("Video loading timeout"))
          }, 10000)
        })
      }

      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
      const errorMessage = error instanceof Error ? error.message : "Unknown camera error"
      alert(
        `Camera Error: ${errorMessage}\n\nPlease:\n1. Allow camera permissions\n2. Make sure no other app is using the camera\n3. Try refreshing the page`,
      )
    }
  }, [])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  useEffect(() => {
    if (videoRef.current && stream) {
      const video = videoRef.current
      video.srcObject = stream

      const handleVideoReady = () => {
        video.play().catch(console.error)
      }

      video.addEventListener("canplay", handleVideoReady)

      return () => {
        video.removeEventListener("canplay", handleVideoReady)
      }
    }
  }, [stream])

  const captureCurrentFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null

    const canvas = canvasRef.current
    const video = videoRef.current
    const context = canvas.getContext("2d")

    if (!context) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const selectedFilter = availableFilters.find((f) => f.name === currentFilter)?.css || ""
    context.filter = selectedFilter

    context.save()
    context.scale(-1, 1)
    context.drawImage(video, -canvas.width, 0)
    context.restore()

    context.filter = "none"

    return canvas.toDataURL("image/jpeg", 0.9)
  }, [currentFilter, availableFilters])

  const handlePhotoCapture = useCallback(async () => {
    if (isCapturing || capturedPhotos.length >= 3) return

    setIsCapturing(true)

    const countdownSequence = ["3...", "2...", "1...", "Smile..."]

    for (let i = 0; i < countdownSequence.length; i++) {
      setCountdown(countdownSequence[i])
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    setCountdown(null)

    const photoData = captureCurrentFrame()
    if (photoData) {
      const newPhoto = {
        dataUrl: photoData,
        timestamp: Date.now(),
      }
      setCapturedPhotos((prevPhotos) => {
        const updatedPhotos = [...prevPhotos, newPhoto]
        if (updatedPhotos.length === 3) {
          setTimeout(() => setShowPhotoStrip(true), 500)
        }
        return updatedPhotos
      })
    }

    setIsCapturing(false)
  }, [isCapturing, capturedPhotos.length, captureCurrentFrame])

  const createPhotoStrip = useCallback(() => {
    if (!photoStripCanvasRef.current || capturedPhotos.length !== 3) return

    const canvas = photoStripCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const STRIP_WIDTH = 260
    const STRIP_HEIGHT = 650
    const PHOTO_WIDTH = 220
    const PHOTO_HEIGHT = 165
    const MARGIN = 20
    const PHOTO_SPACING = 20

    canvas.width = STRIP_WIDTH
    canvas.height = STRIP_HEIGHT

    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, STRIP_HEIGHT)
    backgroundGradient.addColorStop(0, "#ffffff")
    backgroundGradient.addColorStop(1, "#f8f9fa")
    ctx.fillStyle = backgroundGradient
    ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT)

    ctx.strokeStyle = "#e9ecef"
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, STRIP_WIDTH - 2, STRIP_HEIGHT - 2)

    let loadedCount = 0
    capturedPhotos.forEach((photo, index) => {
      const img = new Image()
      img.onload = () => {
        const yPosition = MARGIN + index * (PHOTO_HEIGHT + PHOTO_SPACING)

        ctx.shadowColor = "rgba(0,0,0,0.15)"
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 3
        ctx.shadowOffsetY = 3

        ctx.fillStyle = "#ffffff"
        ctx.fillRect(MARGIN - 5, yPosition - 5, PHOTO_WIDTH + 10, PHOTO_HEIGHT + 10)

        ctx.drawImage(img, MARGIN, yPosition, PHOTO_WIDTH, PHOTO_HEIGHT)

        ctx.shadowColor = "transparent"
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0

        ctx.strokeStyle = "#dee2e6"
        ctx.lineWidth = 1
        ctx.strokeRect(MARGIN, yPosition, PHOTO_WIDTH, PHOTO_HEIGHT)

        loadedCount++

        if (loadedCount === 3) {
          ctx.fillStyle = "#495057"
          ctx.font = "italic bold 18px Georgia, serif"
          ctx.textAlign = "center"
          const currentDate = new Date().toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
          ctx.fillText(`📸College Wishlist • ${currentDate}`, STRIP_WIDTH / 2, STRIP_HEIGHT - 40)
        }
      }
      img.src = photo.dataUrl
    })
  }, [capturedPhotos])

  useEffect(() => {
    if (showPhotoStrip && capturedPhotos.length === 3) {
      setTimeout(createPhotoStrip, 100)
    }
  }, [showPhotoStrip, capturedPhotos, createPhotoStrip])

  const downloadStrip = () => {
    if (!photoStripCanvasRef.current) return

    const downloadLink = document.createElement("a")
    downloadLink.download = `college-wishlist-photos-${Date.now()}.jpg`
    downloadLink.href = photoStripCanvasRef.current.toDataURL("image/jpeg", 0.9)
    downloadLink.click()
  }

  const resetPhotoBooth = () => {
    setShowPhotoStrip(false)
    setCapturedPhotos([])
    setCountdown(null)
  }

  if (showCurtains) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-200 via-pink-200 to-orange-300 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          {backgroundClouds.map((cloud, index) => (
            <div
              key={index}
              className="absolute bg-white rounded-full"
              style={{
                width: cloud.width,
                height: cloud.height,
                left: `${cloud.left}%`,
                top: `${cloud.top}%`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-center min-h-screen relative">
          <div className="text-center z-20">
            <div className="bg-red-600 text-white px-8 py-4 rounded-full text-2xl font-bold mb-4 shadow-lg">
              Welcome To College Wishlist
            </div>
            <div
              className="bg-gradient-to-b from-red-600 to-red-700 w-64 h-64 mx-auto rounded-lg flex items-center justify-center shadow-xl cursor-pointer hover:scale-105 transition-transform duration-200"
              onClick={initializePhotoBooth}
            >
              <div className="text-yellow-400 text-sm font-bold text-center leading-tight">
                INSERT
                <br />
                COIN HERE
              </div>
            </div>
          </div>

          <div className="absolute inset-0 z-10 pointer-events-none">
            <div
              className={`absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-red-800 via-red-700 to-red-600 shadow-2xl transition-transform duration-2000 ease-in-out ${
                curtainsAnimating ? "-translate-x-full" : "translate-x-0"
              }`}
              style={{
                background: "repeating-linear-gradient(90deg, #991b1b 0px, #dc2626 20px, #b91c1c 40px)",
                boxShadow: "inset -20px 0 40px rgba(0,0,0,0.3), 20px 0 40px rgba(0,0,0,0.5)",
              }}
            >
              <div className="absolute inset-0 opacity-30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-8 bg-gradient-to-r from-red-900 to-transparent"
                    style={{ left: `${i * 12.5}%` }}
                  />
                ))}
              </div>
            </div>

            <div
              className={`absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-red-800 via-red-700 to-red-600 shadow-2xl transition-transform duration-2000 ease-in-out ${
                curtainsAnimating ? "translate-x-full" : "translate-x-0"
              }`}
              style={{
                background: "repeating-linear-gradient(270deg, #991b1b 0px, #dc2626 20px, #b91c1c 40px)",
                boxShadow: "inset 20px 0 40px rgba(0,0,0,0.3), -20px 0 40px rgba(0,0,0,0.5)",
              }}
            >
              <div className="absolute inset-0 opacity-30">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full w-8 bg-gradient-to-l from-red-900 to-transparent"
                    style={{ right: `${i * 12.5}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-yellow-600 to-yellow-800 shadow-lg z-30">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-yellow-600 to-yellow-500 opacity-50"></div>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-1 w-6 h-6 bg-yellow-700 rounded-full shadow-md"
                  style={{ left: `${8 + i * 8}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-200 via-pink-200 to-orange-300 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          {backgroundClouds.map((cloud, index) => (
            <div
              key={index}
              className="absolute bg-white rounded-full"
              style={{
                width: cloud.width,
                height: cloud.height,
                left: `${cloud.left}%`,
                top: `${cloud.top}%`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="bg-red-600 text-white px-8 py-4 rounded-full text-2xl font-bold mb-4 shadow-lg">
              Welcome To College Wishlist
            </div>
            <div className="text-white text-xl">Loading camera...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-200 via-pink-200 to-orange-300 relative overflow-hidden">
      <div className="absolute inset-0 opacity-40">
        {backgroundClouds.map((cloud, index) => (
          <div
            key={index}
            className="absolute bg-white rounded-full"
            style={{
              width: cloud.width,
              height: cloud.height,
              left: `${cloud.left}%`,
              top: `${cloud.top}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        {!showPhotoStrip ? (
          <Card className="bg-black rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    filter: availableFilters.find((f) => f.name === currentFilter)?.css || "",
                    transform: currentFilter === "Fisheye" ? "scaleX(-1) scale(1.1)" : "scaleX(-1)",
                  }}
                />

                {countdown && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                    <div className="text-white text-6xl font-bold animate-pulse text-center">{countdown}</div>
                  </div>
                )}

                {capturedPhotos.length > 0 && (
                  <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold">
                    {capturedPhotos.length}/3
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-4 px-1">
                {availableFilters.map((filter) => (
                  <Button
                    key={filter.name}
                    variant={currentFilter === filter.name ? "default" : "ghost"}
                    size="sm"
                    className={`text-xs px-2 py-1 h-8 min-w-0 ${
                      currentFilter === filter.name
                        ? "bg-yellow-500 text-black hover:bg-yellow-600 font-semibold"
                        : "text-white hover:bg-gray-800"
                    }`}
                    onClick={() => setCurrentFilter(filter.name)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>

              <div className="flex justify-center mt-6">
                <Button
                  onClick={handlePhotoCapture}
                  disabled={isCapturing || capturedPhotos.length >= 3}
                  className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 text-black p-0 shadow-lg disabled:opacity-50"
                >
                  <Camera className="w-8 h-8" />
                </Button>
              </div>

              <div className="text-center mt-4">
                <p className="text-white text-sm">
                  {capturedPhotos.length === 0 && "Click to take your first photo"}
                  {capturedPhotos.length === 1 && "Great! Take 2 more photos"}
                  {capturedPhotos.length === 2 && "One more photo to go!"}
                  {capturedPhotos.length === 3 && "All photos taken!"}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-amber-900 to-amber-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl border-0">
            <div className="flex gap-8 items-center justify-center">
              <div className="bg-white p-6 rounded-2xl shadow-2xl transform rotate-1 hover:rotate-0 transition-transform duration-300">
                <canvas ref={photoStripCanvasRef} className="max-w-[240px] w-full h-auto rounded-lg shadow-inner" />
              </div>

              <div className="flex flex-col gap-4">
                <Button
                  onClick={resetPhotoBooth}
                  className="bg-amber-700 hover:bg-amber-600 text-white px-8 py-4 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-amber-600"
                >
                  Reshoot
                </Button>
                <Button
                  onClick={downloadStrip}
                  className="bg-amber-700 hover:bg-amber-600 text-white px-8 py-4 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-amber-600"
                >
                  Download Strip
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
