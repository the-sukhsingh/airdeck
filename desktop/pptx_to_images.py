import os
import sys
import subprocess

try:
    import win32com.client
except ImportError:
    print("pywin32 not found. Attempting to install...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pywin32"])
        import win32com.client
    except Exception as e:
        print(f"EXPORT_ERROR: failed to import or install pywin32: {str(e)}")
        sys.exit(1)

def export_slides(pptx_path, output_dir):
    # Ensure absolute paths
    pptx_path = os.path.abspath(pptx_path)
    output_dir = os.path.abspath(output_dir)
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    ppt = None
    try:
        # Launch PowerPoint in background
        ppt = win32com.client.Dispatch("PowerPoint.Application")
        ppt.Visible = True
        
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
        if ppt is not None:
            try:
                ppt.Quit()
            except Exception:
                pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pptx_to_images.py <pptx_path> <output_dir>")
        sys.exit(1)
    export_slides(sys.argv[1], sys.argv[2])
