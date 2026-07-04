import os
import sys
import win32com.client

def export_slides(pptx_path, output_dir):
    # Ensure absolute paths
    pptx_path = os.path.abspath(pptx_path)
    output_dir = os.path.abspath(output_dir)
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    # Launch PowerPoint in background
    ppt = win32com.client.Dispatch("PowerPoint.Application")
    ppt.Visible = True
    
    try:
        # Open presentation
        pres = ppt.Presentations.Open(pptx_path, WithWindow=False)
        # Export all slides as PNG images to the output directory at high resolution (1080p)
        pres.Export(output_dir, "PNG", 1920, 1080)
        pres.Close()
        print(f"EXPORT_SUCCESS: {len(os.listdir(output_dir))} slides exported")
    except Exception as e:
        print(f"EXPORT_ERROR: {str(e)}")
        sys.exit(1)
    finally:
        ppt.Quit()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pptx_to_images.py <pptx_path> <output_dir>")
        sys.exit(1)
    export_slides(sys.argv[1], sys.argv[2])
