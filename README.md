# Domain Categorizer

An AI-powered web application for categorizing premium domain names using OpenAI's GPT models. The application processes lists of words, detects their languages, translates non-English words, and categorizes them based on provided categories.

## Features

- **Multi-file Upload**: Upload categories, languages, and words as separate text files
- **AI-Powered Processing**: Uses OpenAI GPT-4o-mini for language detection, translation, and categorization
- **Progress Tracking**: Real-time progress monitoring with resume capability
- **Error Handling**: Robust error management with retry mechanisms
- **CSV Export**: Export results as CSV files
- **Persistent Storage**: Files and progress are saved locally for resuming interrupted processes

## Prerequisites

- Node.js 18+ 
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd categorizer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```bash
# OpenAI API Key - Get yours from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Prepare Your Files

Create three text files with the following format:

**categories.txt** (one category per line):
```
Technology
Finance
Health
Education
Entertainment
```

**languages.txt** (optional, one language per line):
```
Spanish
French
German
Italian
```

**words.txt** (one word per line):
```
apple
banana
manzana
pomme
computer
```

### 2. Upload Files

1. Upload your categories file first
2. Optionally upload your languages file
3. Upload your words file

### 3. Start Processing

Click "Start Processing" to begin the AI-powered categorization. The application will:

1. Detect the language of each word
2. Translate non-English words to English
3. Categorize each word based on the provided categories
4. Show real-time progress

### 4. Export Results

Once processing is complete, click "Export CSV" to download the results.

## File Format

The exported CSV file contains the following columns:
- **Original Word**: The word as it appeared in your input file
- **Language**: The detected language of the word
- **English Translation**: The English translation (same as original if already English)
- **Category**: The assigned category (empty if no match found)

## API Endpoints

- `POST /api/upload` - Upload files
- `POST /api/process` - Start/control processing
- `GET /api/status` - Get current status
- `GET /api/download` - Download CSV files

## Architecture

- **Frontend**: Next.js 15.3 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes
- **AI**: OpenAI GPT-4o-mini API
- **Storage**: Local file system
- **UI Components**: Custom components with Lucide React icons

## Error Handling

The application includes comprehensive error handling:

- **File Upload Errors**: Validates file types and content
- **API Errors**: Handles OpenAI API rate limits and failures
- **Processing Errors**: Continues processing even if individual words fail
- **Resume Capability**: Can resume interrupted processing from where it left off

## Performance Considerations

- Processing includes a 100ms delay between API calls to avoid rate limiting
- Large files are processed in batches
- Progress is saved every few words to enable resuming
- Results are displayed in real-time

## Security

- File uploads are validated for type and content
- Downloaded files are restricted to the data directory
- API keys are stored in environment variables

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## License

This project is for internal use only.

## Support

For issues or questions, please contact the development team. 