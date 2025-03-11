import os


def write_extension_code_to_file(extension_dir, output_file):
    """
    Recursively reads all files in the extension directory and writes their content to a single text file.

    Args:
        extension_dir (str): Path to the extension directory
        output_file (str): Path to the output text file
    """
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk(extension_dir):
            for file in files:
                # Skip node_modules, dist, and other common directories to ignore
                if any(ignore in root for ignore in ['node_modules', 'dist', '.git']):
                    continue

                # Get file extension
                _, file_ext = os.path.splitext(file)

                # List of file extensions to include
                valid_extensions = ['.ts', '.tsx', '.js',
                                    '.jsx', '.html', '.css', '.py']

                invalid_files = ['package-lock.json']

                if file_ext in valid_extensions and file not in invalid_files:
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, extension_dir)

                    try:
                        with open(file_path, 'r', encoding='utf-8') as infile:
                            content = infile.read()

                            # Write file header
                            outfile.write(f"\n{'='*80}\n")
                            outfile.write(f"File: {relative_path}\n")
                            outfile.write(f"{'='*80}\n\n")

                            # Write file content
                            outfile.write(content)
                            outfile.write("\n\n")
                    except Exception as e:
                        outfile.write(
                            f"Error reading file {file_path}: {str(e)}\n")


if __name__ == "__main__":
    # Specify the extension directory and output file
    # Adjust this path to match your project structure
    extension_dir = "./"
    output_file = "full_code.txt"

    write_extension_code_to_file(extension_dir, output_file)
    print(f"Code has been written to {output_file}")
