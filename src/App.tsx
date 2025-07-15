import { useState, useEffect, useRef, useCallback } from 'react'
import { blink } from './blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Badge } from './components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Progress } from './components/ui/progress'
import { Separator } from './components/ui/separator'
import { ScrollArea } from './components/ui/scroll-area'
import { 
  Globe, 
  MessageSquare, 
  Copy, 
  Sparkles, 
  Brain, 
  CheckCircle,
  ExternalLink,
  Loader2,
  Twitter,
  Linkedin,
  Hash,
  User,
  Bot,
  Save,
  FolderOpen,
  Plus,
  Trash2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Project {
  id: string
  userId: string
  name: string
  websiteUrl?: string
  websiteTitle?: string
  websiteDescription?: string
  websiteContent?: string
  websiteMetadata?: any
  selectedPlatforms?: string[]
  createdAt: string
  updatedAt: string
}

interface WebsiteData {
  url: string
  title: string
  description: string
  content: string
  metadata: any
}

interface GeneratedPost {
  id?: string
  platform: string
  content: string
  characterCount: number
  reasoning: string
}

interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const PLATFORMS = [
  { id: 'producthunt', name: 'Product Hunt', icon: Hash, limit: 260, color: 'bg-orange-500' },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, limit: 280, color: 'bg-black' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, limit: 3000, color: 'bg-blue-600' },
  { id: 'reddit', name: 'Reddit', icon: MessageSquare, limit: 40000, color: 'bg-orange-600' }
]

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['producthunt'])
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isChatting, setIsChatting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
      if (state.user && !state.isLoading) {
        loadProjects()
      }
    })
    return unsubscribe
  }, [loadProjects])

  // Load user's projects
  const loadProjects = useCallback(async () => {
    if (!user) return
    
    setIsLoadingProjects(true)
    try {
      const userProjects = await blink.db.projects.list({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' }
      })
      setProjects(userProjects)
      
      // Auto-load the most recent project if no current project
      if (!currentProject && userProjects.length > 0) {
        loadProject(userProjects[0])
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }, [user, currentProject])

  // Load a specific project
  const loadProject = async (project: Project) => {
    setCurrentProject(project)
    
    // Load project data
    if (project.websiteUrl) {
      setWebsiteUrl(project.websiteUrl)
      setWebsiteData({
        url: project.websiteUrl,
        title: project.websiteTitle || '',
        description: project.websiteDescription || '',
        content: project.websiteContent || '',
        metadata: project.websiteMetadata ? JSON.parse(project.websiteMetadata) : {}
      })
    }
    
    if (project.selectedPlatforms) {
      setSelectedPlatforms(project.selectedPlatforms)
    }
    
    // Load generated posts
    try {
      const posts = await blink.db.generatedPosts.list({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' }
      })
      setGeneratedPosts(posts.map(post => ({
        id: post.id,
        platform: post.platform,
        content: post.content,
        characterCount: post.characterCount,
        reasoning: post.reasoning || ''
      })))
    } catch (error) {
      console.error('Error loading posts:', error)
    }
    
    // Load chat messages
    try {
      const messages = await blink.db.chatMessages.list({
        where: { projectId: project.id },
        orderBy: { createdAt: 'asc' }
      })
      setChatMessages(messages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt)
      })))
    } catch (error) {
      console.error('Error loading chat messages:', error)
    }
    
    toast.success(`Loaded project: ${project.name}`)
  }

  // Create a new project
  const createNewProject = async () => {
    if (!user) return
    
    const projectName = `Launch Project ${new Date().toLocaleDateString()}`
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const newProject: Project = {
        id: projectId,
        userId: user.id,
        name: projectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await blink.db.projects.create(newProject)
      
      // Reset current state
      setWebsiteUrl('')
      setWebsiteData(null)
      setSelectedPlatforms(['producthunt'])
      setGeneratedPosts([])
      setChatMessages([])
      
      // Update projects list and set as current
      setProjects(prev => [newProject, ...prev])
      setCurrentProject(newProject)
      setShowProjectSelector(false)
      
      toast.success('New project created!')
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Failed to create new project')
    }
  }

  // Save current project
  const saveProject = async () => {
    if (!user || !currentProject) return
    
    setIsSaving(true)
    try {
      const updatedProject: Partial<Project> = {
        name: currentProject.name,
        websiteUrl: websiteData?.url,
        websiteTitle: websiteData?.title,
        websiteDescription: websiteData?.description,
        websiteContent: websiteData?.content,
        websiteMetadata: websiteData?.metadata ? JSON.stringify(websiteData.metadata) : null,
        selectedPlatforms,
        updatedAt: new Date().toISOString()
      }
      
      await blink.db.projects.update(currentProject.id, updatedProject)
      
      // Update local state
      setCurrentProject(prev => prev ? { ...prev, ...updatedProject } : null)
      setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, ...updatedProject } : p))
      
      toast.success('Project saved!')
    } catch (error) {
      console.error('Error saving project:', error)
      toast.error('Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete a project
  const deleteProject = async (projectId: string) => {
    if (!user) return
    
    try {
      await blink.db.projects.delete(projectId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
      
      if (currentProject?.id === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId)
        if (remainingProjects.length > 0) {
          loadProject(remainingProjects[0])
        } else {
          setCurrentProject(null)
          setWebsiteUrl('')
          setWebsiteData(null)
          setSelectedPlatforms(['producthunt'])
          setGeneratedPosts([])
          setChatMessages([])
        }
      }
      
      toast.success('Project deleted!')
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
    }
  }

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isChatting])

  const extractWebsiteData = async () => {
    if (!websiteUrl.trim()) {
      toast.error('Please enter a website URL')
      return
    }

    // Create a new project if user doesn't have one
    if (!currentProject && user) {
      await createNewProject()
    }

    setIsExtracting(true)
    setProgress(0)
    setCurrentStep('Extracting website content...')

    try {
      setProgress(25)
      const { markdown, metadata } = await blink.data.scrape(websiteUrl)
      
      setProgress(75)
      setCurrentStep('Processing content...')
      
      const websiteInfo: WebsiteData = {
        url: websiteUrl,
        title: metadata.title || 'Untitled',
        description: metadata.description || '',
        content: markdown,
        metadata
      }
      
      setWebsiteData(websiteInfo)
      setProgress(100)
      setCurrentStep('Website data extracted successfully!')
      
      // Auto-save project if we have one
      if (currentProject && user) {
        try {
          const updatedProject: Partial<Project> = {
            websiteUrl: websiteInfo.url,
            websiteTitle: websiteInfo.title,
            websiteDescription: websiteInfo.description,
            websiteContent: websiteInfo.content,
            websiteMetadata: JSON.stringify(websiteInfo.metadata),
            updatedAt: new Date().toISOString()
          }
          
          await blink.db.projects.update(currentProject.id, updatedProject)
          setCurrentProject(prev => prev ? { ...prev, ...updatedProject } : null)
          setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, ...updatedProject } : p))
        } catch (error) {
          console.error('Error auto-saving project:', error)
        }
      }
      
      toast.success('Website content extracted successfully!')
    } catch (error) {
      console.error('Error extracting website:', error)
      toast.error('Failed to extract website content')
    } finally {
      setIsExtracting(false)
      setTimeout(() => {
        setProgress(0)
        setCurrentStep('')
      }, 2000)
    }
  }

  const generatePosts = async () => {
    if (!websiteData || selectedPlatforms.length === 0) {
      toast.error('Please extract website data and select platforms first')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setCurrentStep('Generating launch posts...')

    try {
      const posts: GeneratedPost[] = []
      
      for (let i = 0; i < selectedPlatforms.length; i++) {
        const platform = selectedPlatforms[i]
        const platformInfo = PLATFORMS.find(p => p.id === platform)
        
        setProgress((i / selectedPlatforms.length) * 80)
        setCurrentStep(`Generating ${platformInfo?.name} post...`)

        const prompt = `You are an expert product launch copywriter. Create an optimized launch post for ${platformInfo?.name}.

Website Information:
- Title: ${websiteData.title}
- Description: ${websiteData.description}
- URL: ${websiteData.url}
- Content: ${websiteData.content.substring(0, 2000)}...

Platform: ${platformInfo?.name}
Character Limit: ${platformInfo?.limit}

Requirements:
1. Create compelling, engaging copy that drives clicks and engagement
2. Use proven launch strategies and hooks
3. Include relevant hashtags and mentions where appropriate
4. Stay within character limits
5. Make it platform-specific and optimized

Please provide:
1. The final post content
2. Your reasoning and strategy behind the copy

Format your response as JSON:
{
  "content": "the actual post content",
  "reasoning": "explanation of your strategy and choices"
}`

        const { text } = await blink.ai.generateText({
          prompt,
          model: 'gpt-4o-mini'
        })

        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(text)
          posts.push({
            platform,
            content: parsed.content || text,
            characterCount: (parsed.content || text).length,
            reasoning: parsed.reasoning || 'Generated using AI optimization strategies'
          })
        } catch {
          // If JSON parsing fails, try to extract content from markdown-like format
          const contentMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/)
          if (contentMatch) {
            try {
              const parsed = JSON.parse(contentMatch[1])
              posts.push({
                platform,
                content: parsed.content || text,
                characterCount: (parsed.content || text).length,
                reasoning: parsed.reasoning || 'Generated using AI optimization strategies'
              })
            } catch {
              // Final fallback
              posts.push({
                platform,
                content: text,
                characterCount: text.length,
                reasoning: 'Generated using AI optimization strategies'
              })
            }
          } else {
            // Final fallback
            posts.push({
              platform,
              content: text,
              characterCount: text.length,
              reasoning: 'Generated using AI optimization strategies'
            })
          }
        }
      }

      setGeneratedPosts(posts)
      
      // Save posts to database if we have a current project
      if (currentProject && user) {
        try {
          for (const post of posts) {
            const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            await blink.db.generatedPosts.create({
              id: postId,
              projectId: currentProject.id,
              userId: user.id,
              platform: post.platform,
              content: post.content,
              characterCount: post.characterCount,
              reasoning: post.reasoning,
              createdAt: new Date().toISOString()
            })
          }
        } catch (error) {
          console.error('Error saving posts to database:', error)
        }
      }
      
      setProgress(100)
      setCurrentStep('Launch posts generated successfully!')
      toast.success('Launch posts generated successfully!')
      
    } catch (error) {
      console.error('Error generating posts:', error)
      toast.error('Failed to generate launch posts')
    } finally {
      setIsGenerating(false)
      setTimeout(() => {
        setProgress(0)
        setCurrentStep('')
      }, 2000)
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !websiteData) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatting(true)

    try {
      const context = `
Current website: ${websiteData.title} (${websiteData.url})
Current generated posts: ${generatedPosts.map(p => `${p.platform}: ${p.content}`).join('\n\n')}
`

      const { text } = await blink.ai.generateText({
        prompt: `You are an AI Product Launch expert. Help the user improve their launch posts.

Context: ${context}

User message: ${chatInput}

Provide helpful, actionable advice for improving their launch strategy and copy.`,
        model: 'gpt-4o-mini'
      })

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: text,
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, assistantMessage])
      
      // Save chat messages to database if we have a current project
      if (currentProject && user) {
        try {
          const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const assistantMsgId = `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`
          
          await blink.db.chatMessages.create({
            id: userMsgId,
            projectId: currentProject.id,
            userId: user.id,
            role: 'user',
            content: userMessage.content,
            createdAt: userMessage.timestamp.toISOString()
          })
          
          await blink.db.chatMessages.create({
            id: assistantMsgId,
            projectId: currentProject.id,
            userId: user.id,
            role: 'assistant',
            content: assistantMessage.content,
            createdAt: assistantMessage.timestamp.toISOString()
          })
        } catch (error) {
          console.error('Error saving chat messages to database:', error)
        }
      }
    } catch (error) {
      console.error('Error in chat:', error)
      toast.error('Failed to get AI response')
    } finally {
      setIsChatting(false)
    }
  }

  const copyToClipboard = (content: string, platform: string) => {
    navigator.clipboard.writeText(content)
    toast.success(`${platform} post copied to clipboard!`)
  }

  const togglePlatform = async (platformId: string) => {
    const newPlatforms = selectedPlatforms.includes(platformId) 
      ? selectedPlatforms.filter(id => id !== platformId)
      : [...selectedPlatforms, platformId]
    
    setSelectedPlatforms(newPlatforms)
    
    // Auto-save platform selection if we have a current project
    if (currentProject && user) {
      try {
        const updatedProject: Partial<Project> = {
          selectedPlatforms: newPlatforms,
          updatedAt: new Date().toISOString()
        }
        
        await blink.db.projects.update(currentProject.id, updatedProject)
        setCurrentProject(prev => prev ? { ...prev, ...updatedProject } : null)
        setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, ...updatedProject } : p))
      } catch (error) {
        console.error('Error auto-saving platform selection:', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Launch Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Please sign in to start generating your launch posts
            </p>
            <Button onClick={() => blink.auth.login()} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-semibold">AI Product Launch Generator</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Project Management */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProjectSelector(!showProjectSelector)}
                  disabled={isLoadingProjects}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {currentProject ? currentProject.name : 'Select Project'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={createNewProject}
                  disabled={isLoadingProjects}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                
                {currentProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveProject}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              
              <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>
              <Button variant="outline" size="sm" onClick={() => blink.auth.logout()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Project Selector Dropdown */}
      {showProjectSelector && (
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Your Projects</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProjectSelector(false)}
                >
                  ×
                </Button>
              </div>
              
              {isLoadingProjects ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading projects...</span>
                </div>
              ) : projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <Card
                      key={project.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        currentProject?.id === project.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => {
                        loadProject(project)
                        setShowProjectSelector(false)
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{project.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {project.websiteUrl || 'No website set'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Updated {new Date(project.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {currentProject?.id === project.id && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm('Are you sure you want to delete this project?')) {
                                  deleteProject(project.id)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No projects yet</p>
                  <Button onClick={createNewProject}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Project
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Input & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* URL Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Website URL
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://yourproduct.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    disabled={isExtracting}
                  />
                  <Button 
                    onClick={extractWebsiteData}
                    disabled={isExtracting || !websiteUrl.trim()}
                  >
                    {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Extract'}
                  </Button>
                </div>
                
                {(isExtracting || progress > 0) && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-muted-foreground">{currentStep}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Website Preview */}
            {websiteData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Website Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h3 className="font-medium">{websiteData.title}</h3>
                    <p className="text-sm text-muted-foreground">{websiteData.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ExternalLink className="h-4 w-4" />
                    <a href={websiteData.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {websiteData.url}
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Platform Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Platforms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PLATFORMS.map((platform) => {
                  const Icon = platform.icon
                  const isSelected = selectedPlatforms.includes(platform.id)
                  
                  return (
                    <div
                      key={platform.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => togglePlatform(platform.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${platform.color} text-white`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{platform.name}</p>
                          <p className="text-sm text-muted-foreground">{platform.limit} chars</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                    </div>
                  )
                })}
                
                <Button 
                  onClick={generatePosts}
                  disabled={!websiteData || selectedPlatforms.length === 0 || isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Launch Posts
                    </>
                  )}
                </Button>
                
                {(isGenerating || progress > 0) && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-muted-foreground">{currentStep}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Generated Posts & Chat */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="posts">Generated Posts</TabsTrigger>
                <TabsTrigger value="chat">AI Chat</TabsTrigger>
              </TabsList>
              
              <TabsContent value="posts" className="space-y-6">
                {generatedPosts.length > 0 ? (
                  <div className="space-y-6">
                    {generatedPosts.map((post, index) => {
                      const platform = PLATFORMS.find(p => p.id === post.platform)
                      const Icon = platform?.icon || Hash
                      
                      return (
                        <Card key={index}>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`p-2 rounded ${platform?.color} text-white`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                {platform?.name}
                              </div>
                              <Badge variant={post.characterCount > (platform?.limit || 0) ? 'destructive' : 'secondary'}>
                                {post.characterCount}/{platform?.limit} chars
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Post Content */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">Generated Post</h4>
                                <Badge variant="outline" className="text-xs">
                                  {post.characterCount} chars
                                </Badge>
                              </div>
                              <div className="bg-muted p-4 rounded-lg border">
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{post.content}</pre>
                              </div>
                            </div>
                            
                            {/* AI Reasoning */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Brain className="h-4 w-4 text-primary" />
                                <h4 className="font-medium text-sm">AI Strategy & Reasoning</h4>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  className="text-sm text-blue-900 dark:text-blue-100 prose prose-sm max-w-none prose-blue"
                                  components={{
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                                    li: ({ children }) => <li className="text-sm">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    code: ({ children }) => <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded text-xs">{children}</code>
                                  }}
                                >
                                  {post.reasoning}
                                </ReactMarkdown>
                              </div>
                            </div>
                            
                            <Button 
                              onClick={() => copyToClipboard(post.content, platform?.name || 'Post')}
                              className="w-full"
                              variant="outline"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Post to Clipboard
                            </Button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No posts generated yet</h3>
                      <p className="text-muted-foreground">
                        Extract your website data and select platforms to generate optimized launch posts
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="chat" className="space-y-4">
                <Card className="flex flex-col" style={{ height: `${Math.max(600, chatMessages.length * 120 + 300)}px` }}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      AI Launch Expert
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col min-h-0">
                    <ScrollArea className="flex-1 pr-4">
                      <div className="space-y-6 pb-4">
                        {chatMessages.length === 0 && (
                          <div className="text-center text-muted-foreground py-12">
                            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                              <Bot className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="font-medium mb-2">AI Launch Expert Ready</h3>
                            <p className="text-sm">Start a conversation to improve your launch posts with expert strategies</p>
                          </div>
                        )}
                        
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {message.role === 'assistant' && (
                              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            
                            <div
                              className={`max-w-[85%] ${
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-md'
                                  : 'bg-muted rounded-2xl rounded-tl-md'
                              } p-4 shadow-sm`}
                            >
                              {message.role === 'assistant' ? (
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  className="text-sm prose prose-sm max-w-none dark:prose-invert"
                                  components={{
                                    p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 ml-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 ml-2">{children}</ol>,
                                    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                    code: ({ children }) => <code className="bg-muted-foreground/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                                    pre: ({ children }) => <pre className="bg-muted-foreground/10 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-3">{children}</pre>,
                                    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/30 pl-4 italic mb-3">{children}</blockquote>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              ) : (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                              )}
                              
                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-current/10">
                                <p className="text-xs opacity-70">
                                  {message.timestamp.toLocaleTimeString()}
                                </p>
                                {message.role === 'assistant' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                                    onClick={() => copyToClipboard(message.content, 'AI Response')}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {message.role === 'user' && (
                              <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {isChatting && (
                          <div className="flex gap-3 justify-start">
                            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                            <div className="bg-muted rounded-2xl rounded-tl-md p-4 shadow-sm">
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">AI is thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={chatEndRef} />
                      </div>
                    </ScrollArea>
                    
                    <Separator className="my-4" />
                    
                    <div className="flex gap-3">
                      <Textarea
                        placeholder="Ask the AI to improve your launch posts, suggest strategies, or refine your messaging..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendChatMessage()
                          }
                        }}
                        disabled={isChatting || !websiteData}
                        className="resize-none min-h-[80px]"
                        rows={3}
                      />
                      <Button 
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim() || isChatting || !websiteData}
                        size="lg"
                        className="px-6"
                      >
                        {isChatting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App