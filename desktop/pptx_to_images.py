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
        # Launch PowerPoint in background (headless)
        ppt = win32com.client.Dispatch("PowerPoint.Application")
        
        # Open presentation. WithWindow=False keeps the application window hidden
        pres = ppt.Presentations.Open(pptx_path, WithWindow=False)
        slide_count = len(pres.Slides)
        
        # Export slides one by one to report progress
        for i in range(1, slide_count + 1):
            slide = pres.Slides(i)
            # Save as Slide<index>.PNG (lossless PNG for crisp text rendering)
            slide_path = os.path.join(output_dir, f"Slide{i}.PNG")
            slide.Export(slide_path, "PNG", 1920, 1080)
            
            # Print progress tokens to stdout
            print(f"PROGRESS:{i}:{slide_count}")
            sys.stdout.flush()
            
        pres.Close()
        print(f"EXPORT_SUCCESS: {slide_count} slides exported")
    except Exception as e:
        print(f"EXPORT_ERROR: {str(e)}")
        sys.stdout.flush()
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
